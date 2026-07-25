class_name WorkerAgent
extends Node2D

enum State {
	IDLE,
	MOVING_TO_SUPPLY,
	PICKING_UP,
	MOVING_TO_JOB,
	WORKING,
}

const CONSTRUCTION_JOB := &"construction"
const DECONSTRUCTION_JOB := &"deconstruction"

@export var movement_speed := 120.0
@export var pickup_duration := 0.5
@export var construction_duration := 2.0

var state := State.IDLE
var _game_clock: GameClock
var _navigation: NavigationGrid
var _job_board: JobBoard
var _construction: ConstructionManager
var _supplies: SupplyDepot
var _target_cell := JobBoard.INVALID_CELL
var _supply_cell := JobBoard.INVALID_CELL
var _job_type: StringName = &""
var _carried_item: StringName = &""
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
		State.MOVING_TO_SUPPLY, State.MOVING_TO_JOB:
			_update_movement(simulation_delta)
		State.PICKING_UP:
			_update_pickup(simulation_delta)
		State.WORKING:
			_update_work(simulation_delta)


func _try_claim_job() -> void:
	var current_cell := _navigation.world_to_cell(position)
	if _try_claim_construction(current_cell):
		return
	if _try_claim_deconstruction(current_cell):
		return
	_idle_retry = 0.5


func _try_claim_construction(current_cell: Vector2i) -> bool:
	for job_cell in _job_board.get_available_construction_jobs(current_cell):
		var object_id := _construction.get_blueprint_at(job_cell)
		var required_item := ConstructionCatalog.get_required_item(object_id)
		for box_cell in _supplies.get_available_boxes(required_item):
			var path_to_supply := _navigation.find_path_to_adjacent(
				current_cell,
				box_cell
			)
			if path_to_supply.is_empty():
				continue
			var supply_access_cell: Vector2i = path_to_supply.back()
			if _navigation.find_path_to_adjacent(
				supply_access_cell,
				job_cell
			).is_empty():
				continue
			if not _supplies.reserve_from_box(
				box_cell,
				required_item,
				get_instance_id()
			):
				continue
			if not _job_board.claim_construction(
				job_cell,
				get_instance_id()
			):
				_supplies.release_reservation(get_instance_id())
				continue

			_target_cell = job_cell
			_supply_cell = box_cell
			_job_type = CONSTRUCTION_JOB
			_path = path_to_supply
			_path_index = 1 if _path.size() > 1 else _path.size()
			state = State.MOVING_TO_SUPPLY
			queue_redraw()
			return true
	return false


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

		_target_cell = job_cell
		_job_type = DECONSTRUCTION_JOB
		_path = path
		_path_index = 1 if _path.size() > 1 else _path.size()
		state = State.MOVING_TO_JOB
		queue_redraw()
		return true
	return false


func _update_movement(delta: float) -> void:
	if not _is_target_valid():
		_cancel_job()
		return
	if _path_index >= _path.size():
		if state == State.MOVING_TO_SUPPLY:
			state = State.PICKING_UP
		else:
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
	if not _is_target_valid() or not _supplies.has_reservation(get_instance_id()):
		_cancel_job()
		return
	_action_progress += delta
	if _action_progress < pickup_duration:
		queue_redraw()
		return

	_carried_item = _supplies.take_reserved_item(get_instance_id())
	if _carried_item.is_empty():
		_cancel_job()
		return

	var current_cell := _navigation.world_to_cell(position)
	_path = _navigation.find_path_to_adjacent(current_cell, _target_cell)
	if _path.is_empty():
		_cancel_job()
		return
	_path_index = 1 if _path.size() > 1 else _path.size()
	_action_progress = 0.0
	state = State.MOVING_TO_JOB
	queue_redraw()


func _update_work(delta: float) -> void:
	if not _is_target_valid():
		_cancel_job()
		return
	_action_progress += delta
	if _action_progress < construction_duration:
		queue_redraw()
		return

	if _job_type == CONSTRUCTION_JOB:
		if _construction.complete_blueprint(_target_cell):
			_job_board.complete_construction(_target_cell, get_instance_id())
			_carried_item = &""
			_finish_job()
	elif _construction.complete_deconstruction(_target_cell):
		_job_board.complete_deconstruction(_target_cell, get_instance_id())
		_finish_job()


func _is_target_valid() -> bool:
	if _target_cell == JobBoard.INVALID_CELL:
		return false
	if _job_type == CONSTRUCTION_JOB:
		return (
			not _construction.get_blueprint_at(_target_cell).is_empty()
			and _job_board.has_construction_job(_target_cell)
		)
	return (
		not _construction.get_completed_object_at(_target_cell).is_empty()
		and _job_board.has_deconstruction_job(_target_cell)
	)


func _cancel_job() -> void:
	_supplies.release_reservation(get_instance_id())
	if not _carried_item.is_empty() and _supply_cell != JobBoard.INVALID_CELL:
		_supplies.return_item_to_box(_supply_cell, _carried_item)
		_carried_item = &""

	if _target_cell != JobBoard.INVALID_CELL:
		if _job_type == CONSTRUCTION_JOB:
			_job_board.release_construction(_target_cell, get_instance_id())
		else:
			_job_board.release_deconstruction(_target_cell, get_instance_id())
	_finish_job()


func _finish_job() -> void:
	state = State.IDLE
	_target_cell = JobBoard.INVALID_CELL
	_supply_cell = JobBoard.INVALID_CELL
	_job_type = &""
	_path.clear()
	_path_index = 0
	_action_progress = 0.0
	_idle_retry = 0.15
	queue_redraw()


func _draw() -> void:
	if (
		not _path.is_empty()
		and (
			state == State.MOVING_TO_SUPPLY
			or state == State.MOVING_TO_JOB
		)
	):
		var points := PackedVector2Array([Vector2.ZERO])
		for index in range(_path_index, _path.size()):
			points.append(to_local(_navigation.cell_to_world(_path[index])))
		if points.size() >= 2:
			draw_polyline(points, Color(0.35, 0.7, 0.9, 0.45), 2.0)

	draw_circle(Vector2.ZERO, 11.0, Color("3f83a6"))
	draw_circle(Vector2.ZERO, 11.0, Color("b8d8e8"), false, 2.0)
	draw_rect(Rect2(-5, -2, 10, 4), Color("d9c28a"), true)

	if not _carried_item.is_empty():
		var item_color := SupplyDepot.get_item_color(_carried_item)
		draw_rect(Rect2(-6, -20, 12, 9), item_color, true)
		draw_rect(Rect2(-6, -20, 12, 9), Color.WHITE, false, 1.0)

	if state == State.PICKING_UP or state == State.WORKING:
		var duration := (
			pickup_duration
			if state == State.PICKING_UP
			else construction_duration
		)
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
