extends SceneTree


func _init() -> void:
	var task := WorkerTaskState.new()
	var cells: Array[Vector2i] = [Vector2i(2, 3), Vector2i(3, 3)]
	task.begin_delivery_batch(
		&"construction",
		cells,
		&"wall_section",
		Vector2i(1, 1),
		SupplyDepot.SOURCE_BOX
	)
	cells.clear()

	assert(task.job_type == &"construction")
	assert(task.target_cell == Vector2i(1, 1))
	assert(task.batch_cells.size() == 2)
	assert(task.pending_delivery.size() == 2)
	assert(task.pending_build.is_empty())

	task.carried_quantity = 2
	task.reset()
	assert(task.job_type.is_empty())
	assert(task.target_cell == JobBoard.INVALID_CELL)
	assert(task.batch_cells.is_empty())
	assert(task.carried_quantity == 0)

	print("WorkerTaskState tests passed")
	quit()
