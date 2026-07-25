class_name WorkerAgent
extends Node2D

enum State {
	IDLE,
	MOVING,
	WORKING,
}

@export var movement_speed := 120.0
@export var construction_duration := 2.0

var state := State.IDLE
var _game_clock: GameClock
var _navigation: NavigationGrid
var _job_board: JobBoard
var _construction: ConstructionManager
var _target_cell := JobBoard.INVALID_CELL
var _path: Array[Vector2i] = []
var _path_index := 0
var _work_progress := 0.0
var _idle_retry := 0.0


func setup(
	game_clock: GameClock,
	navigation: NavigationGrid,
	job_board: JobBoard,
	construction: ConstructionManager
) -> void:
	_game_clock = game_clock
	_navigation = navigation
	_job_board = job_board
	_construction = construction
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
		State.MOVING:
			_update_movement(simulation_delta)
		State.WORKING:
			_update_work(simulation_delta)


func _try_claim_job() -> void:
	var current_cell := _navigation.world_to_cell(position)
	for cell in _job_board.get_available_construction_jobs(current_cell):
		var path := _navigation.find_path_to_adjacent(current_cell, cell)
		if path.is_empty():
			continue
		if not _job_board.claim_construction(cell, get_instance_id()):
			continue

		_target_cell = cell
		_path = path
		_path_index = 1 if path.size() > 1 else path.size()
		state = State.MOVING
		queue_redraw()
		return

	_idle_retry = 0.5


func _update_movement(delta: float) -> void:
	if not _is_target_valid():
		_cancel_job()
		return
	if _path_index >= _path.size():
		state = State.WORKING
		_work_progress = 0.0
		queue_redraw()
		return

	var target_position := _navigation.cell_to_world(_path[_path_index])
	position = position.move_toward(target_position, movement_speed * delta)
	if position.is_equal_approx(target_position):
		_path_index += 1
	queue_redraw()


func _update_work(delta: float) -> void:
	if not _is_target_valid():
		_cancel_job()
		return
	_work_progress += delta
	if _work_progress < construction_duration:
		queue_redraw()
		return

	if _construction.complete_blueprint(_target_cell):
		_job_board.complete_construction(_target_cell, get_instance_id())
		_finish_job()


func _is_target_valid() -> bool:
	return (
		_target_cell != JobBoard.INVALID_CELL
		and not _construction.get_blueprint_at(_target_cell).is_empty()
		and _job_board.has_construction_job(_target_cell)
	)


func _cancel_job() -> void:
	if _target_cell != JobBoard.INVALID_CELL:
		_job_board.release_construction(_target_cell, get_instance_id())
	_finish_job()


func _finish_job() -> void:
	state = State.IDLE
	_target_cell = JobBoard.INVALID_CELL
	_path.clear()
	_path_index = 0
	_work_progress = 0.0
	_idle_retry = 0.15
	queue_redraw()


func _draw() -> void:
	if not _path.is_empty() and state == State.MOVING:
		var points := PackedVector2Array([Vector2.ZERO])
		for index in range(_path_index, _path.size()):
			points.append(to_local(_navigation.cell_to_world(_path[index])))
		if points.size() >= 2:
			draw_polyline(points, Color(0.35, 0.7, 0.9, 0.45), 2.0)

	draw_circle(Vector2.ZERO, 11.0, Color("3f83a6"))
	draw_circle(Vector2.ZERO, 11.0, Color("b8d8e8"), false, 2.0)
	draw_rect(Rect2(-5, -2, 10, 4), Color("d9c28a"), true)

	if state == State.WORKING:
		var ratio := clampf(_work_progress / construction_duration, 0.0, 1.0)
		draw_arc(
			Vector2.ZERO,
			15.0,
			-PI / 2.0,
			-PI / 2.0 + TAU * ratio,
			24,
			Color("f0d36b"),
			3.0
		)
