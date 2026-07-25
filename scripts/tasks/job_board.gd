class_name JobBoard
extends Node

const INVALID_CELL := Vector2i(-1, -1)

var _construction_jobs: Dictionary[Vector2i, int] = {}


func sync_construction_jobs(cells: Array[Vector2i]) -> void:
	var current_cells: Dictionary[Vector2i, bool] = {}
	for cell in cells:
		current_cells[cell] = true
		if not _construction_jobs.has(cell):
			_construction_jobs[cell] = 0

	var stale_cells: Array[Vector2i] = []
	for cell: Vector2i in _construction_jobs:
		if not current_cells.has(cell):
			stale_cells.append(cell)
	for cell in stale_cells:
		_construction_jobs.erase(cell)


func claim_nearest_construction(agent_id: int, origin: Vector2i) -> Vector2i:
	var best_cell := INVALID_CELL
	var best_distance := INF
	for cell: Vector2i in _construction_jobs:
		if _construction_jobs[cell] != 0:
			continue
		var distance := origin.distance_squared_to(cell)
		if distance < best_distance:
			best_distance = distance
			best_cell = cell

	if best_cell != INVALID_CELL:
		_construction_jobs[best_cell] = agent_id
	return best_cell


func release_construction(cell: Vector2i, agent_id: int) -> void:
	if _construction_jobs.get(cell, 0) == agent_id:
		_construction_jobs[cell] = 0


func complete_construction(cell: Vector2i, agent_id: int) -> void:
	if _construction_jobs.get(cell, 0) == agent_id:
		_construction_jobs.erase(cell)


func has_construction_job(cell: Vector2i) -> bool:
	return _construction_jobs.has(cell)


func get_construction_job_count() -> int:
	return _construction_jobs.size()
