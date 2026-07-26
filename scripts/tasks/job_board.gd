class_name JobBoard
extends Node

const INVALID_CELL := Vector2i(-1, -1)

var _construction_jobs: Dictionary[Vector2i, int] = {}
var _deconstruction_jobs: Dictionary[Vector2i, int] = {}


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


func sync_deconstruction_jobs(cells: Array[Vector2i]) -> void:
	var current_cells: Dictionary[Vector2i, bool] = {}
	for cell in cells:
		current_cells[cell] = true
		if not _deconstruction_jobs.has(cell):
			_deconstruction_jobs[cell] = 0

	var stale_cells: Array[Vector2i] = []
	for cell: Vector2i in _deconstruction_jobs:
		if not current_cells.has(cell):
			stale_cells.append(cell)
	for cell in stale_cells:
		_deconstruction_jobs.erase(cell)


func get_available_construction_jobs(origin: Vector2i) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	for cell: Vector2i in _construction_jobs:
		if _construction_jobs[cell] == 0:
			result.append(cell)
	result.sort_custom(
		func(first: Vector2i, second: Vector2i) -> bool:
			return (
				origin.distance_squared_to(first)
				< origin.distance_squared_to(second)
			)
	)
	return result


func claim_construction(cell: Vector2i, agent_id: int) -> bool:
	if _construction_jobs.get(cell, -1) != 0:
		return false
	_construction_jobs[cell] = agent_id
	return true


func get_available_deconstruction_jobs(origin: Vector2i) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	for cell: Vector2i in _deconstruction_jobs:
		if _deconstruction_jobs[cell] == 0:
			result.append(cell)
	result.sort_custom(
		func(first: Vector2i, second: Vector2i) -> bool:
			return (
				origin.distance_squared_to(first)
				< origin.distance_squared_to(second)
			)
	)
	return result


func claim_deconstruction(cell: Vector2i, agent_id: int) -> bool:
	if _deconstruction_jobs.get(cell, -1) != 0:
		return false
	_deconstruction_jobs[cell] = agent_id
	return true


func release_construction(cell: Vector2i, agent_id: int) -> void:
	if _construction_jobs.get(cell, 0) == agent_id:
		_construction_jobs[cell] = 0


func complete_construction(cell: Vector2i, agent_id: int) -> void:
	if _construction_jobs.get(cell, 0) == agent_id:
		_construction_jobs.erase(cell)


func release_deconstruction(cell: Vector2i, agent_id: int) -> void:
	if _deconstruction_jobs.get(cell, 0) == agent_id:
		_deconstruction_jobs[cell] = 0


func complete_deconstruction(cell: Vector2i, agent_id: int) -> void:
	if _deconstruction_jobs.get(cell, 0) == agent_id:
		_deconstruction_jobs.erase(cell)


func has_construction_job(cell: Vector2i) -> bool:
	return _construction_jobs.has(cell)


func has_deconstruction_job(cell: Vector2i) -> bool:
	return _deconstruction_jobs.has(cell)


func get_construction_job_count() -> int:
	return _construction_jobs.size()


func get_deconstruction_job_count() -> int:
	return _deconstruction_jobs.size()


func has_valid_state() -> bool:
	for cell: Vector2i in _construction_jobs:
		if int(_construction_jobs[cell]) < 0:
			return false
		if _deconstruction_jobs.has(cell):
			return false
	for agent_id: int in _deconstruction_jobs.values():
		if agent_id < 0:
			return false
	return true
