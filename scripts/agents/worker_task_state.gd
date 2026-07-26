class_name WorkerTaskState
extends RefCounted

var job_type: StringName = &""
var target_cell := JobBoard.INVALID_CELL
var supply_cell := JobBoard.INVALID_CELL
var supply_source_type := SupplyDepot.SOURCE_BOX
var item_id: StringName = &""
var batch_cells: Array[Vector2i] = []
var pending_delivery: Array[Vector2i] = []
var pending_build: Array[Vector2i] = []
var carried_quantity := 0


func begin_staged_construction(
	p_job_type: StringName,
	cell: Vector2i,
	p_item_id: StringName
) -> void:
	reset()
	job_type = p_job_type
	target_cell = cell
	item_id = p_item_id
	batch_cells = [cell]
	pending_build = [cell]


func begin_delivery_batch(
	p_job_type: StringName,
	cells: Array[Vector2i],
	p_item_id: StringName,
	p_supply_cell: Vector2i,
	p_supply_source_type: StringName
) -> void:
	reset()
	job_type = p_job_type
	target_cell = p_supply_cell
	supply_cell = p_supply_cell
	supply_source_type = p_supply_source_type
	item_id = p_item_id
	batch_cells = cells.duplicate()
	pending_delivery = cells.duplicate()


func begin_single_job(p_job_type: StringName, cell: Vector2i) -> void:
	reset()
	job_type = p_job_type
	target_cell = cell


func is_valid() -> bool:
	if carried_quantity < 0:
		return false
	if carried_quantity > 0 and item_id.is_empty():
		return false
	var batch_set: Dictionary[Vector2i, bool] = {}
	for cell in batch_cells:
		if batch_set.has(cell):
			return false
		batch_set[cell] = true
	for cell in pending_delivery:
		if not batch_set.has(cell):
			return false
	for cell in pending_build:
		if not batch_set.has(cell):
			return false
	return true


func reset() -> void:
	job_type = &""
	target_cell = JobBoard.INVALID_CELL
	supply_cell = JobBoard.INVALID_CELL
	supply_source_type = SupplyDepot.SOURCE_BOX
	item_id = &""
	batch_cells.clear()
	pending_delivery.clear()
	pending_build.clear()
	carried_quantity = 0
