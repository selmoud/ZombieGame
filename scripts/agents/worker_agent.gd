class_name WorkerAgent
extends Node2D

enum State {
	IDLE,
	MOVING_TO_SUPPLY,
	PICKING_UP,
	DELIVERING_MATERIAL,
	PLACING_MATERIAL,
	RETURNING_MATERIAL,
	MOVING_TO_JOB,
	WORKING,
}

const CONSTRUCTION_JOB := &"construction"
const DECONSTRUCTION_JOB := &"deconstruction"
const BATCH_RADIUS := 3
const CARRY_CAPACITY := 4

@export var movement_speed := 120.0
@export var pickup_duration := 0.5
@export var delivery_duration := 0.25
@export var construction_duration := 2.0

var state := State.IDLE
var _game_clock: GameClock
var _navigation: NavigationGrid
var _job_board: JobBoard
var _construction: ConstructionManager
var _supplies: SupplyDepot

var _job_type: StringName = &""
var _target_cell := JobBoard.INVALID_CELL
var _supply_cell := JobBoard.INVALID_CELL
var _batch_item: StringName = &""
var _batch_cells: Array[Vector2i] = []
var _pending_delivery: Array[Vector2i] = []
var _pending_build: Array[Vector2i] = []
var _carried_quantity := 0

var _path: Array[Vector2i] = []
var _path_index := 0
var _action_progress := 0.0
var _idle_retry := 0.0


func setup(
	game_clock: GameClock,
	navigation: NavigationGrid,
	job_board: JobBoard,
	construction: ConstructionManager,
	supplies: SupplyDepot
) -> void:
	_game_clock = game_clock
	_navigation = navigation
	_job_board = job_board
	_construction = construction
	_supplies = supplies
	queue_redraw()


func _process(delta: float) -> void:
	if _game_clock == null or _game_clock.speed == 0.0:
		return
	var simulation_delta := delta * _game_clock.speed

	match state:
		State.IDLE:
			_idle_retry -= simulation_delta
			if _idle_retry <= 0.0:
				_try_claim_job()
		State.MOVING_TO_SUPPLY, State.DELIVERING_MATERIAL, \
				State.RETURNING_MATERIAL, State.MOVING_TO_JOB:
			_update_movement(simulation_delta)
		State.PICKING_UP:
			_update_pickup(simulation_delta)
		State.PLACING_MATERIAL:
			_update_delivery(simulation_delta)
		State.WORKING:
			_update_work(simulation_delta)


func get_carry_capacity(_item_id: StringName) -> int:
	return CARRY_CAPACITY


func _try_claim_job() -> void:
	var current_cell := _navigation.world_to_cell(position)
	if _try_claim_staged_construction(current_cell):
		return
	if _try_claim_construction_batch(current_cell):
		return
	if _try_claim_deconstruction(current_cell):
		return
	_idle_retry = 0.5


func _try_claim_staged_construction(current_cell: Vector2i) -> bool:
	for cell in _job_board.get_available_construction_jobs(current_cell):
		if not _construction.has_staged_material(cell):
			continue
		var path := _navigation.find_path_to_adjacent(current_cell, cell)
		if path.is_empty():
			continue
		if not _job_board.claim_construction(cell, get_instance_id()):
			continue
		_job_type = CONSTRUCTION_JOB
		_batch_item = _construction.get_staged_material(cell)
		_batch_cells = [cell]
		_pending_build = [cell]
		_target_cell = cell
		_path = path
		_path_index = 1 if _path.size() > 1 else _path.size()
		state = State.MOVING_TO_JOB
		queue_redraw()
		return true
	return false


func _try_claim_construction_batch(current_cell: Vector2i) -> bool:
	var available_jobs := _job_board.get_available_construction_jobs(current_cell)
	for first_cell in available_jobs:
		var object_id := _construction.get_blueprint_at(first_cell)
		var item_id := ConstructionCatalog.get_required_item(object_id)
		var capacity := get_carry_capacity(item_id)
		var candidates := _get_batch_candidates(
			first_cell,
			item_id,
			available_jobs,
			capacity
		)
		if candidates.is_empty():
			continue

		for box_cell in _supplies.get_available_boxes(item_id):
			var path_to_supply := _navigation.find_path_to_adjacent(
				current_cell,
				box_cell
			)
			if path_to_supply.is_empty():
				continue
			var supply_access_cell: Vector2i = path_to_supply.back()
			var reachable_candidates: Array[Vector2i] = []
			for candidate in candidates:
				if not _navigation.find_path_to_adjacent(
					supply_access_cell,
					candidate
				).is_empty():
					reachable_candidates.append(candidate)

			var batch_size := mini(
				reachable_candidates.size(),
				_supplies.get_available_quantity_in_box(box_cell)
			)
			if batch_size <= 0:
				continue
			reachable_candidates.resize(batch_size)

			var claimed_cells: Array[Vector2i] = []
			for candidate in reachable_candidates:
				if _job_board.claim_construction(
					candidate,
					get_instance_id()
				):
					claimed_cells.append(candidate)
			if claimed_cells.is_empty():
				continue
			if not _supplies.reserve_quantity_from_box(
				box_cell,
				item_id,
				claimed_cells.size(),
				get_instance_id()
			):
				_release_construction_claims(claimed_cells)
				continue

			_job_type = CONSTRUCTION_JOB
			_batch_item = item_id
			_batch_cells = claimed_cells.duplicate()
			_pending_delivery = claimed_cells.duplicate()
			_pending_build.clear()
			_supply_cell = box_cell
			_target_cell = box_cell
			_path = path_to_supply
			_path_index = 1 if _path.size() > 1 else _path.size()
			state = State.MOVING_TO_SUPPLY
			queue_redraw()
			return true
	return false


func _get_batch_candidates(
	first_cell: Vector2i,
	item_id: StringName,
	available_jobs: Array[Vector2i],
	capacity: int
) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	for cell in available_jobs:
		if (
			absi(cell.x - first_cell.x) > BATCH_RADIUS
			or absi(cell.y - first_cell.y) > BATCH_RADIUS
			or ConstructionCatalog.get_required_item(
				_construction.get_blueprint_at(cell)
			) != item_id
		):
			continue
		result.append(cell)
		if result.size() >= capacity:
			break
	return result


func _try_claim_deconstruction(current_cell: Vector2i) -> bool:
	for job_cell in _job_board.get_available_deconstruction_jobs(current_cell):
		var path := _navigation.find_path_to_adjacent(current_cell, job_cell)
		if path.is_empty():
			continue
		if not _job_board.claim_deconstruction(
			job_cell,
			get_instance_id()
		):
			continue

		_job_type = DECONSTRUCTION_JOB
		_target_cell = job_cell
		_path = path
		_path_index = 1 if _path.size() > 1 else _path.size()
		state = State.MOVING_TO_JOB
		queue_redraw()
		return true
	return false


func _update_movement(delta: float) -> void:
	if state == State.MOVING_TO_SUPPLY and not _has_valid_batch_jobs():
		_cancel_job()
		return
	if (
		state == State.DELIVERING_MATERIAL
		and not _is_valid_construction_job(_target_cell)
	):
		_pending_delivery.erase(_target_cell)
		_start_next_delivery()
		return
	if (
		state == State.MOVING_TO_JOB
		and not _is_current_work_target_valid()
	):
		if _job_type == CONSTRUCTION_JOB:
			_pending_build.erase(_target_cell)
			_start_next_build()
		else:
			_cancel_job()
		return

	if _path_index >= _path.size():
		match state:
			State.MOVING_TO_SUPPLY:
				state = State.PICKING_UP
			State.DELIVERING_MATERIAL:
				state = State.PLACING_MATERIAL
				_action_progress = 0.0
				queue_redraw()
				return
			State.RETURNING_MATERIAL:
				_store_carried_material()
				_start_next_build()
				return
			State.MOVING_TO_JOB:
				state = State.WORKING
		_action_progress = 0.0
		queue_redraw()
		return

	var target_position := _navigation.cell_to_world(_path[_path_index])
	position = position.move_toward(target_position, movement_speed * delta)
	if position.is_equal_approx(target_position):
		_path_index += 1
	queue_redraw()


func _update_pickup(delta: float) -> void:
	if not _has_valid_batch_jobs() or not _supplies.has_reservation(
		get_instance_id()
	):
		_cancel_job()
		return
	_action_progress += delta
	if _action_progress < pickup_duration:
		queue_redraw()
		return

	var taken := _supplies.take_reserved_quantity(get_instance_id())
	if taken.is_empty():
		_cancel_job()
		return
	_batch_item = taken["item_id"]
	_carried_quantity = taken["quantity"]
	_action_progress = 0.0
	_start_next_delivery()


func _start_next_delivery() -> void:
	_prune_cancelled_batch_cells()
	if _pending_delivery.is_empty():
		_start_next_build()
		return

	var current_cell := _navigation.world_to_cell(position)
	var next_cell := _find_nearest_reachable(_pending_delivery, current_cell)
	if next_cell == JobBoard.INVALID_CELL:
		for cell in _pending_delivery:
			_job_board.release_construction(cell, get_instance_id())
			_batch_cells.erase(cell)
		_pending_delivery.clear()
		_start_return_material()
		return

	_target_cell = next_cell
	_path = _navigation.find_path_to_adjacent(current_cell, next_cell)
	_path_index = 1 if _path.size() > 1 else _path.size()
	state = State.DELIVERING_MATERIAL
	queue_redraw()


func _update_delivery(delta: float) -> void:
	if not _is_valid_construction_job(_target_cell):
		_pending_delivery.erase(_target_cell)
		_start_next_delivery()
		return
	_action_progress += delta
	if _action_progress < delivery_duration:
		queue_redraw()
		return
	if (
		_carried_quantity > 0
		and _construction.stage_material(_target_cell, _batch_item)
	):
		_carried_quantity -= 1
		_pending_build.append(_target_cell)
	_pending_delivery.erase(_target_cell)
	_action_progress = 0.0
	_start_next_delivery()


func _start_return_material() -> void:
	if _carried_quantity <= 0:
		_start_next_build()
		return
	var current_cell := _navigation.world_to_cell(position)
	var path := _navigation.find_path_to_adjacent(
		current_cell,
		_supply_cell
	)
	if path.is_empty():
		_drop_carried_material()
		_start_next_build()
		return
	_target_cell = _supply_cell
	_path = path
	_path_index = 1 if path.size() > 1 else path.size()
	state = State.RETURNING_MATERIAL
	queue_redraw()


func _store_carried_material() -> void:
	if _carried_quantity <= 0:
		return
	_supplies.return_items_to_box(
		_supply_cell,
		_batch_item,
		_carried_quantity
	)
	_carried_quantity = 0


func _drop_carried_material() -> void:
	if _carried_quantity <= 0:
		return
	var current_cell := _navigation.world_to_cell(position)
	_supplies.drop_loose_items(
		current_cell,
		_batch_item,
		_carried_quantity
	)
	_carried_quantity = 0


func _start_next_build() -> void:
	_prune_cancelled_batch_cells()
	var valid_build_cells: Array[Vector2i] = []
	for cell in _pending_build:
		if (
			_is_valid_construction_job(cell)
			and _construction.has_staged_material(cell)
		):
			valid_build_cells.append(cell)
	_pending_build = valid_build_cells

	if _pending_build.is_empty():
		if _carried_quantity > 0:
			_start_return_material()
			return
		_release_construction_claims(_batch_cells)
		_finish_job()
		return

	var current_cell := _navigation.world_to_cell(position)
	var next_cell := _find_nearest_reachable(_pending_build, current_cell)
	if next_cell == JobBoard.INVALID_CELL:
		_release_construction_claims(_pending_build)
		for cell in _pending_build:
			_batch_cells.erase(cell)
		_pending_build.clear()
		if _carried_quantity > 0:
			_start_return_material()
		else:
			_finish_job()
		return

	var build_path := _navigation.find_path_to_adjacent(current_cell, next_cell)
	if _carried_quantity > 0:
		var return_path := _navigation.find_path_to_adjacent(
			current_cell,
			_supply_cell
		)
		if not return_path.is_empty() and return_path.size() <= build_path.size():
			_start_return_material()
			return

	_target_cell = next_cell
	_path = build_path
	_path_index = 1 if _path.size() > 1 else _path.size()
	state = State.MOVING_TO_JOB
	queue_redraw()


func _update_work(delta: float) -> void:
	if not _is_current_work_target_valid():
		if _job_type == CONSTRUCTION_JOB:
			_pending_build.erase(_target_cell)
			_start_next_build()
		else:
			_cancel_job()
		return

	_action_progress += delta
	if _action_progress < construction_duration:
		queue_redraw()
		return

	if _job_type == CONSTRUCTION_JOB:
		if _construction.complete_blueprint(_target_cell):
			_job_board.complete_construction(_target_cell, get_instance_id())
		_pending_build.erase(_target_cell)
		_batch_cells.erase(_target_cell)
		_start_next_build()
	elif _construction.complete_deconstruction(_target_cell):
		_job_board.complete_deconstruction(_target_cell, get_instance_id())
		_finish_job()


func _find_nearest_reachable(
	cells: Array[Vector2i],
	origin: Vector2i
) -> Vector2i:
	var best_cell := JobBoard.INVALID_CELL
	var best_path_size := INF
	for cell in cells:
		var path := _navigation.find_path_to_adjacent(origin, cell)
		if path.is_empty():
			continue
		if path.size() < best_path_size:
			best_path_size = path.size()
			best_cell = cell
	return best_cell


func _has_valid_batch_jobs() -> bool:
	_prune_cancelled_batch_cells()
	return not _batch_cells.is_empty()


func _prune_cancelled_batch_cells() -> void:
	var valid_cells: Array[Vector2i] = []
	for cell in _batch_cells:
		if _is_valid_construction_job(cell):
			valid_cells.append(cell)
		else:
			_pending_delivery.erase(cell)
			_pending_build.erase(cell)
	_batch_cells = valid_cells


func _is_valid_construction_job(cell: Vector2i) -> bool:
	return (
		not _construction.get_blueprint_at(cell).is_empty()
		and _job_board.has_construction_job(cell)
	)


func _is_current_work_target_valid() -> bool:
	if _target_cell == JobBoard.INVALID_CELL:
		return false
	if _job_type == CONSTRUCTION_JOB:
		return (
			_is_valid_construction_job(_target_cell)
			and _construction.has_staged_material(_target_cell)
		)
	return (
		not _construction.get_completed_object_at(_target_cell).is_empty()
		and _job_board.has_deconstruction_job(_target_cell)
	)


func _release_construction_claims(cells: Array[Vector2i]) -> void:
	for cell in cells:
		_job_board.release_construction(cell, get_instance_id())


func _cancel_job() -> void:
	_supplies.release_reservation(get_instance_id())
	if _carried_quantity > 0:
		_start_return_material()
		return
	if _job_type == CONSTRUCTION_JOB:
		_release_construction_claims(_batch_cells)
	elif _target_cell != JobBoard.INVALID_CELL:
		_job_board.release_deconstruction(_target_cell, get_instance_id())
	_finish_job()


func _finish_job() -> void:
	state = State.IDLE
	_job_type = &""
	_target_cell = JobBoard.INVALID_CELL
	_supply_cell = JobBoard.INVALID_CELL
	_batch_item = &""
	_batch_cells.clear()
	_pending_delivery.clear()
	_pending_build.clear()
	_carried_quantity = 0
	_path.clear()
	_path_index = 0
	_action_progress = 0.0
	_idle_retry = 0.15
	queue_redraw()


func _draw() -> void:
	if not _path.is_empty() and state in [
		State.MOVING_TO_SUPPLY,
		State.DELIVERING_MATERIAL,
		State.RETURNING_MATERIAL,
		State.MOVING_TO_JOB,
	]:
		var points := PackedVector2Array([Vector2.ZERO])
		for index in range(_path_index, _path.size()):
			points.append(to_local(_navigation.cell_to_world(_path[index])))
		if points.size() >= 2:
			draw_polyline(points, Color(0.35, 0.7, 0.9, 0.45), 2.0)

	draw_circle(Vector2.ZERO, 11.0, Color("3f83a6"))
	draw_circle(Vector2.ZERO, 11.0, Color("b8d8e8"), false, 2.0)
	draw_rect(Rect2(-5, -2, 10, 4), Color("d9c28a"), true)

	if _carried_quantity > 0:
		var item_color := SupplyDepot.get_item_color(_batch_item)
		var width := 8.0 + minf(float(_carried_quantity), 6.0) * 2.0
		draw_rect(Rect2(-width / 2.0, -20, width, 9), item_color, true)
		draw_rect(
			Rect2(-width / 2.0, -20, width, 9),
			Color.WHITE,
			false,
			1.0
		)

	if state in [State.PICKING_UP, State.PLACING_MATERIAL, State.WORKING]:
		var duration := construction_duration
		if state == State.PICKING_UP:
			duration = pickup_duration
		elif state == State.PLACING_MATERIAL:
			duration = delivery_duration
		var ratio := clampf(_action_progress / duration, 0.0, 1.0)
		draw_arc(
			Vector2.ZERO,
			15.0,
			-PI / 2.0,
			-PI / 2.0 + TAU * ratio,
			24,
			Color("f0d36b"),
			3.0
		)
