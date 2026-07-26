class_name WorkerAgent
extends Node2D

signal inspection_requested(worker: WorkerAgent)

enum State {
	IDLE,
	MOVING_TO_SUPPLY,
	PICKING_UP,
	DELIVERING_MATERIAL,
	PLACING_MATERIAL,
	RETURNING_MATERIAL,
	MOVING_TO_JOB,
	WORKING,
	WAITING_FOR_BUILD_CELL,
	VACATING_BLUEPRINT,
}

const CONSTRUCTION_JOB := &"construction"
const DECONSTRUCTION_JOB := &"deconstruction"
const BATCH_RADIUS := 3
const CARRY_CAPACITY := 4
const BUILD_RETRY_INTERVAL := 1.0

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

var _task := WorkerTaskState.new()

var _path: Array[Vector2i] = []
var _path_index := 0
var _action_progress := 0.0
var _idle_retry := 0.0
var _state_after_vacating := State.IDLE
var _is_inspected := false


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
	add_to_group(&"workers")
	queue_redraw()


func _process(delta: float) -> void:
	if _game_clock == null or _game_clock.speed == 0.0:
		return
	var simulation_delta := delta * _game_clock.speed

	match state:
		State.IDLE:
			if _try_vacate_blueprint(
				_navigation.world_to_cell(position),
				State.IDLE
			):
				return
			_idle_retry -= simulation_delta
			if _idle_retry <= 0.0:
				_try_claim_job()
		State.MOVING_TO_SUPPLY, State.DELIVERING_MATERIAL, \
				State.RETURNING_MATERIAL, State.MOVING_TO_JOB, \
				State.VACATING_BLUEPRINT:
			_update_movement(simulation_delta)
		State.PICKING_UP:
			_update_pickup(simulation_delta)
		State.PLACING_MATERIAL:
			_update_delivery(simulation_delta)
		State.WORKING:
			_update_work(simulation_delta)
		State.WAITING_FOR_BUILD_CELL:
			_update_build_retry(simulation_delta)


func get_carry_capacity(_item_id: StringName) -> int:
	return CARRY_CAPACITY


func has_valid_task_state() -> bool:
	return _task.is_valid()


func set_inspected(value: bool) -> void:
	_is_inspected = value
	queue_redraw()


func get_inspector_text() -> String:
	var target_text := "—"
	if _task.target_cell != JobBoard.INVALID_CELL:
		target_text = "%d, %d" % [_task.target_cell.x, _task.target_cell.y]

	var cargo_text := "—"
	if _task.carried_quantity > 0:
		cargo_text = "%s ×%d" % [
			ItemCatalog.get_label(_task.item_id),
			_task.carried_quantity,
		]

	var route_parts := PackedStringArray()
	for index in range(_path_index, mini(_path.size(), _path_index + 6)):
		var cell: Vector2i = _path[index]
		route_parts.append("(%d,%d)" % [cell.x, cell.y])
	if _path.size() - _path_index > 6:
		route_parts.append("…")
	var route_text := " → ".join(route_parts) if not route_parts.is_empty() else "—"

	return (
		"%s\n"
		+ "Состояние: %s\n"
		+ "Задача: %s\n"
		+ "Цель: %s\n"
		+ "Груз: %s\n"
		+ "Ожидание: %s\n"
		+ "Маршрут: %s"
	) % [
		name,
		_get_state_label(),
		_get_job_label(),
		target_text,
		cargo_text,
		_get_waiting_reason(),
		route_text,
	]


func _get_state_label() -> String:
	match state:
		State.IDLE:
			return "Свободен"
		State.MOVING_TO_SUPPLY:
			return "Идёт за материалами"
		State.PICKING_UP:
			return "Забирает материалы"
		State.DELIVERING_MATERIAL:
			return "Доставляет материалы"
		State.PLACING_MATERIAL:
			return "Размещает материалы"
		State.RETURNING_MATERIAL:
			return "Возвращает остаток"
		State.MOVING_TO_JOB:
			return "Идёт к работе"
		State.WORKING:
			return "Работает"
		State.WAITING_FOR_BUILD_CELL:
			return "Ожидает"
		State.VACATING_BLUEPRINT:
			return "Освобождает чертёж"
	return "Неизвестно"


func _get_job_label() -> String:
	if _task.job_type == CONSTRUCTION_JOB:
		return "Строительство"
	if _task.job_type == DECONSTRUCTION_JOB:
		return "Разбор"
	return "Нет"


func _get_waiting_reason() -> String:
	if state == State.IDLE:
		return "Нет доступной задачи"
	if state == State.WAITING_FOR_BUILD_CELL:
		return "Цель занята работником или его маршрутом"
	if state == State.VACATING_BLUEPRINT:
		return "Освобождает клетку для строительства"
	return "—"


func _unhandled_input(event: InputEvent) -> void:
	if (
		event is InputEventMouseButton
		and event.button_index == MOUSE_BUTTON_LEFT
		and event.pressed
		and global_position.distance_to(get_global_mouse_position()) <= 14.0
	):
		inspection_requested.emit(self)
		get_viewport().set_input_as_handled()


func _try_vacate_blueprint(
	current_cell: Vector2i,
	return_state: int
) -> bool:
	if _construction.get_blueprint_at(current_cell).is_empty():
		return false
	var escape_path := _find_blueprint_escape_path(current_cell)
	if escape_path.is_empty():
		_idle_retry = 0.5
		return false
	_task.target_cell = escape_path.back()
	_path = escape_path
	_path_index = 1 if _path.size() > 1 else _path.size()
	_state_after_vacating = return_state
	state = State.VACATING_BLUEPRINT
	queue_redraw()
	return true


func _find_blueprint_escape_path(origin: Vector2i) -> Array[Vector2i]:
	for radius in range(1, 9):
		var best_path: Array[Vector2i] = []
		for x_offset in range(-radius, radius + 1):
			for y_offset in range(-radius, radius + 1):
				if maxi(absi(x_offset), absi(y_offset)) != radius:
					continue
				var candidate := origin + Vector2i(x_offset, y_offset)
				if (
					not _navigation.is_cell_walkable(candidate)
					or not _construction.get_blueprint_at(candidate).is_empty()
					or _supplies.has_box_at(candidate)
					or _is_cell_used_by_other_worker(candidate)
				):
					continue
				var path := _navigation.get_cell_path(origin, candidate)
				if path.is_empty():
					continue
				if best_path.is_empty() or path.size() < best_path.size():
					best_path = path
		if not best_path.is_empty():
			return best_path
	return []


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
		_task.begin_staged_construction(
			CONSTRUCTION_JOB,
			cell,
			_construction.get_staged_material(cell)
		)
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

		var best_option: Dictionary = {}
		var best_score := INF
		for source in _supplies.get_available_sources(item_id):
			var source_cell: Vector2i = source["cell"]
			var path_to_supply := _navigation.find_path_to_adjacent(
				current_cell,
				source_cell
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
				int(source["quantity"])
			)
			if batch_size <= 0:
				continue
			reachable_candidates.resize(batch_size)

			var score := path_to_supply.size()
			if score < best_score:
				best_score = score
				best_option = {
					"cell": source_cell,
					"source_type": source["source_type"],
					"path": path_to_supply,
					"candidates": reachable_candidates,
				}
		if best_option.is_empty():
			continue

		var claimed_cells: Array[Vector2i] = []
		for candidate: Vector2i in best_option["candidates"]:
			if _job_board.claim_construction(
				candidate,
				get_instance_id()
			):
				claimed_cells.append(candidate)
		if claimed_cells.is_empty():
			continue
		if not _supplies.reserve_quantity_from_source(
			best_option["cell"],
			best_option["source_type"],
			item_id,
			claimed_cells.size(),
			get_instance_id()
		):
			_release_construction_claims(claimed_cells)
			continue

		_task.begin_delivery_batch(
			CONSTRUCTION_JOB,
			claimed_cells,
			item_id,
			best_option["cell"],
			best_option["source_type"]
		)
		_path = best_option["path"]
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

		_task.begin_single_job(DECONSTRUCTION_JOB, job_cell)
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
		and not _is_valid_construction_job(_task.target_cell)
	):
		_task.pending_delivery.erase(_task.target_cell)
		_start_next_delivery()
		return
	if (
		state == State.MOVING_TO_JOB
		and not _is_current_work_target_valid()
	):
		if _task.job_type == CONSTRUCTION_JOB:
			_task.pending_build.erase(_task.target_cell)
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
			State.VACATING_BLUEPRINT:
				_finish_vacating_blueprint()
				return
		_action_progress = 0.0
		queue_redraw()
		return

	if not _navigation.is_cell_walkable(_path[_path_index]):
		_recalculate_current_path()
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
	_task.item_id = taken["item_id"]
	_task.carried_quantity = taken["quantity"]
	_action_progress = 0.0
	_start_next_delivery()


func _start_next_delivery() -> void:
	_prune_cancelled_batch_cells()
	if _task.pending_delivery.is_empty():
		_start_next_build()
		return

	var current_cell := _navigation.world_to_cell(position)
	var next_cell := _find_nearest_reachable(_task.pending_delivery, current_cell)
	if next_cell == JobBoard.INVALID_CELL:
		for cell in _task.pending_delivery:
			_job_board.release_construction(cell, get_instance_id())
			_task.batch_cells.erase(cell)
		_task.pending_delivery.clear()
		_start_return_material()
		return

	_task.target_cell = next_cell
	_path = _navigation.find_path_to_adjacent(current_cell, next_cell)
	_path_index = 1 if _path.size() > 1 else _path.size()
	state = State.DELIVERING_MATERIAL
	queue_redraw()


func _update_delivery(delta: float) -> void:
	if not _is_valid_construction_job(_task.target_cell):
		_task.pending_delivery.erase(_task.target_cell)
		_start_next_delivery()
		return
	_action_progress += delta
	if _action_progress < delivery_duration:
		queue_redraw()
		return
	if (
		_task.carried_quantity > 0
		and _construction.stage_material(_task.target_cell, _task.item_id)
	):
		_task.carried_quantity -= 1
		_task.pending_build.append(_task.target_cell)
	_task.pending_delivery.erase(_task.target_cell)
	_action_progress = 0.0
	_start_next_delivery()


func _start_return_material() -> void:
	if _task.carried_quantity <= 0:
		_start_next_build()
		return
	var current_cell := _navigation.world_to_cell(position)
	var path := _navigation.find_path_to_adjacent(
		current_cell,
		_task.supply_cell
	)
	if path.is_empty():
		_drop_carried_material()
		_start_next_build()
		return
	_task.target_cell = _task.supply_cell
	_path = path
	_path_index = 1 if path.size() > 1 else path.size()
	state = State.RETURNING_MATERIAL
	queue_redraw()


func _store_carried_material() -> void:
	if _task.carried_quantity <= 0:
		return
	_supplies.return_items_to_source(
		_task.supply_cell,
		_task.supply_source_type,
		_task.item_id,
		_task.carried_quantity
	)
	_task.carried_quantity = 0


func _drop_carried_material() -> void:
	if _task.carried_quantity <= 0:
		return
	var current_cell := _navigation.world_to_cell(position)
	_supplies.drop_loose_items(
		current_cell,
		_task.item_id,
		_task.carried_quantity
	)
	_task.carried_quantity = 0


func _start_next_build() -> void:
	_prune_cancelled_batch_cells()
	var valid_build_cells: Array[Vector2i] = []
	for cell in _task.pending_build:
		if (
			_is_valid_construction_job(cell)
			and _construction.has_staged_material(cell)
		):
			valid_build_cells.append(cell)
	_task.pending_build = valid_build_cells

	if _task.pending_build.is_empty():
		if _task.carried_quantity > 0:
			_start_return_material()
			return
		_release_construction_claims(_task.batch_cells)
		_finish_job()
		return

	var current_cell := _navigation.world_to_cell(position)
	var reachable_cell := _find_nearest_reachable(_task.pending_build, current_cell)
	if reachable_cell == JobBoard.INVALID_CELL:
		_release_construction_claims(_task.pending_build)
		for cell in _task.pending_build:
			_task.batch_cells.erase(cell)
		_task.pending_build.clear()
		if _task.carried_quantity > 0:
			_start_return_material()
		else:
			_finish_job()
		return

	var next_cell := _find_nearest_buildable(_task.pending_build, current_cell)
	if next_cell == JobBoard.INVALID_CELL:
		if _task.carried_quantity > 0:
			_start_return_material()
		else:
			_begin_build_retry()
		return

	var build_path := _navigation.find_path_to_adjacent(current_cell, next_cell)
	if _task.carried_quantity > 0:
		var return_path := _navigation.find_path_to_adjacent(
			current_cell,
			_task.supply_cell
		)
		if not return_path.is_empty() and return_path.size() <= build_path.size():
			_start_return_material()
			return

	_task.target_cell = next_cell
	_path = build_path
	_path_index = 1 if _path.size() > 1 else _path.size()
	state = State.MOVING_TO_JOB
	queue_redraw()


func _update_work(delta: float) -> void:
	if not _is_current_work_target_valid():
		if _task.job_type == CONSTRUCTION_JOB:
			_task.pending_build.erase(_task.target_cell)
			_start_next_build()
		else:
			_cancel_job()
		return

	_action_progress += delta
	if _action_progress < construction_duration:
		queue_redraw()
		return

	if _task.job_type == CONSTRUCTION_JOB:
		if _is_cell_used_by_other_worker(_task.target_cell):
			_begin_build_retry()
			return
		if _construction.complete_blueprint(_task.target_cell):
			_job_board.complete_construction(_task.target_cell, get_instance_id())
		_task.pending_build.erase(_task.target_cell)
		_task.batch_cells.erase(_task.target_cell)
		_start_next_build()
	elif _construction.complete_deconstruction(_task.target_cell):
		_job_board.complete_deconstruction(_task.target_cell, get_instance_id())
		_finish_job()


func _begin_build_retry() -> void:
	state = State.WAITING_FOR_BUILD_CELL
	_task.target_cell = JobBoard.INVALID_CELL
	_path.clear()
	_path_index = 0
	_action_progress = 0.0
	queue_redraw()


func _update_build_retry(delta: float) -> void:
	if _try_vacate_blueprint(
		_navigation.world_to_cell(position),
		State.WAITING_FOR_BUILD_CELL
	):
		return
	_action_progress += delta
	if _action_progress < BUILD_RETRY_INTERVAL:
		return
	_start_next_build()


func _recalculate_current_path() -> void:
	var current_cell := _navigation.world_to_cell(position)
	var replacement_path: Array[Vector2i]
	if state == State.VACATING_BLUEPRINT:
		replacement_path = _navigation.get_cell_path(
			current_cell,
			_task.target_cell
		)
	else:
		replacement_path = _navigation.find_path_to_adjacent(
			current_cell,
			_task.target_cell
		)
	if not replacement_path.is_empty():
		_path = replacement_path
		_path_index = 1 if _path.size() > 1 else _path.size()
		queue_redraw()
		return

	match state:
		State.MOVING_TO_SUPPLY:
			_cancel_job()
		State.DELIVERING_MATERIAL:
			_task.pending_delivery.erase(_task.target_cell)
			_start_next_delivery()
		State.RETURNING_MATERIAL:
			_drop_carried_material()
			_start_next_build()
		State.MOVING_TO_JOB:
			if _task.job_type == CONSTRUCTION_JOB:
				_task.pending_build.erase(_task.target_cell)
				_start_next_build()
			else:
				_cancel_job()
		State.VACATING_BLUEPRINT:
			_finish_vacating_blueprint()


func _finish_vacating_blueprint() -> void:
	state = _state_after_vacating
	_state_after_vacating = State.IDLE
	_task.target_cell = JobBoard.INVALID_CELL
	_path.clear()
	_path_index = 0
	_action_progress = 0.0
	if state == State.IDLE:
		_idle_retry = 0.0
	queue_redraw()


func _is_cell_used_by_other_worker(cell: Vector2i) -> bool:
	for node in get_tree().get_nodes_in_group(&"workers"):
		if node == self or node is not WorkerAgent:
			continue
		var other_worker := node as WorkerAgent
		if other_worker.is_using_cell(cell):
			return true
	return false


func is_using_cell(cell: Vector2i) -> bool:
	if _navigation == null:
		return false
	if _navigation.world_to_cell(position) == cell:
		return true
	if state not in [
		State.MOVING_TO_SUPPLY,
		State.DELIVERING_MATERIAL,
		State.RETURNING_MATERIAL,
		State.MOVING_TO_JOB,
		State.VACATING_BLUEPRINT,
	]:
		return false
	for index in range(_path_index, _path.size()):
		if _path[index] == cell:
			return true
	return false


func _find_nearest_buildable(
	cells: Array[Vector2i],
	origin: Vector2i
) -> Vector2i:
	var available_cells: Array[Vector2i] = []
	for cell in cells:
		if not _is_cell_used_by_other_worker(cell):
			available_cells.append(cell)
	return _find_nearest_reachable(available_cells, origin)


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
	return not _task.batch_cells.is_empty()


func _prune_cancelled_batch_cells() -> void:
	var valid_cells: Array[Vector2i] = []
	for cell in _task.batch_cells:
		if _is_valid_construction_job(cell):
			valid_cells.append(cell)
		else:
			_task.pending_delivery.erase(cell)
			_task.pending_build.erase(cell)
	_task.batch_cells = valid_cells


func _is_valid_construction_job(cell: Vector2i) -> bool:
	return (
		not _construction.get_blueprint_at(cell).is_empty()
		and _job_board.has_construction_job(cell)
	)


func _is_current_work_target_valid() -> bool:
	if _task.target_cell == JobBoard.INVALID_CELL:
		return false
	if _task.job_type == CONSTRUCTION_JOB:
		return (
			_is_valid_construction_job(_task.target_cell)
			and _construction.has_staged_material(_task.target_cell)
		)
	return (
		not _construction.get_completed_object_at(_task.target_cell).is_empty()
		and _job_board.has_deconstruction_job(_task.target_cell)
	)


func _release_construction_claims(cells: Array[Vector2i]) -> void:
	for cell in cells:
		_job_board.release_construction(cell, get_instance_id())


func _cancel_job() -> void:
	_supplies.release_reservation(get_instance_id())
	if _task.carried_quantity > 0:
		_start_return_material()
		return
	if _task.job_type == CONSTRUCTION_JOB:
		_release_construction_claims(_task.batch_cells)
	elif _task.target_cell != JobBoard.INVALID_CELL:
		_job_board.release_deconstruction(_task.target_cell, get_instance_id())
	_finish_job()


func _finish_job() -> void:
	state = State.IDLE
	_task.reset()
	_path.clear()
	_path_index = 0
	_action_progress = 0.0
	_idle_retry = 0.15
	_state_after_vacating = State.IDLE
	queue_redraw()


func _draw() -> void:
	if not _path.is_empty() and state in [
		State.MOVING_TO_SUPPLY,
		State.DELIVERING_MATERIAL,
		State.RETURNING_MATERIAL,
		State.MOVING_TO_JOB,
		State.VACATING_BLUEPRINT,
	]:
		var points := PackedVector2Array([Vector2.ZERO])
		for index in range(_path_index, _path.size()):
			points.append(to_local(_navigation.cell_to_world(_path[index])))
		if points.size() >= 2:
			draw_polyline(points, Color(0.35, 0.7, 0.9, 0.45), 2.0)

	draw_circle(Vector2.ZERO, 11.0, Color("3f83a6"))
	draw_circle(Vector2.ZERO, 11.0, Color("b8d8e8"), false, 2.0)
	if _is_inspected:
		draw_circle(Vector2.ZERO, 15.0, Color("f0d36b"), false, 3.0)
	draw_rect(Rect2(-5, -2, 10, 4), Color("d9c28a"), true)

	if _task.carried_quantity > 0:
		var item_color := SupplyDepot.get_item_color(_task.item_id)
		var width := 8.0 + minf(float(_task.carried_quantity), 6.0) * 2.0
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
