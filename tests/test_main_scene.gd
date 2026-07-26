extends SceneTree


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var packed_scene: PackedScene = load("res://scenes/main.tscn")
	var main := packed_scene.instantiate()
	root.add_child(main)
	await process_frame

	var zones: ZoneManager = main.get_node("ZoneLayer")
	var construction: ConstructionManager = main.get_node("ConstructionLayer")
	var menu: BuildMenu = main.get_node("Interface/BuildMenu")

	menu.zone_tool_selected.emit(&"residential")
	assert(zones.active_tool == &"residential")
	assert(construction.active_tool.is_empty())
	await process_frame
	var right_click := InputEventMouseButton.new()
	right_click.button_index = MOUSE_BUTTON_RIGHT
	right_click.pressed = true
	Input.parse_input_event(right_click)
	await process_frame
	assert(zones.active_tool.is_empty())
	assert(not zones.is_hover_preview_visible())

	menu.zone_tool_selected.emit(&"residential")
	menu.construction_tool_selected.emit(&"wall")
	assert(construction.active_tool == &"wall")
	assert(zones.active_tool.is_empty())
	Input.parse_input_event(right_click)
	await process_frame
	assert(construction.active_tool.is_empty())

	menu.construction_tool_selected.emit(&"wall")
	menu.cancel_tool_selected.emit()
	assert(zones.active_tool.is_empty())
	assert(construction.active_tool.is_empty())

	var workers: Array[WorkerAgent] = main.workers
	assert(workers.size() == 3)
	var worker: WorkerAgent = workers.front()
	worker.inspection_requested.emit(worker)
	await process_frame
	var inspector: PanelContainer = main.get_node("HUD/WorkerInspector")
	var inspector_details: Label = inspector.get_node("Content/Details")
	var zone_tooltip: PanelContainer = main.get_node("HUD/ZoneTooltip")
	assert(not zone_tooltip.visible)
	assert(inspector.visible)
	assert(inspector_details.text.contains("Состояние:"))
	assert(inspector_details.text.contains("Маршрут:"))
	var escape_event := InputEventKey.new()
	escape_event.keycode = KEY_ESCAPE
	escape_event.pressed = true
	Input.parse_input_event(escape_event)
	await process_frame
	assert(not inspector.visible)
	assert(main.selected_worker == null)
	var clock: GameClock = main.get_node("GameClock")
	var supplies: SupplyDepot = main.get_node("SupplyDepot")
	for current_worker in workers:
		current_worker.movement_speed = 1000.0
		current_worker.pickup_duration = 0.01
		current_worker.delivery_duration = 0.01
		current_worker.construction_duration = 0.01
	assert(worker.get_carry_capacity(&"wall_section") == 4)
	assert(worker.get_carry_capacity(&"door_module") == 4)
	clock.set_speed(4.0)
	assert(not construction.can_place_blueprint(Vector2i(29, 31), &"wall"))
	var initial_wall_sections := supplies.get_total_quantity(&"wall_section")
	var nearby_loose_cell := Vector2i(33, 32)
	supplies.drop_loose_items(nearby_loose_cell, &"wall_section", 1)
	construction.place_blueprint(Vector2i(34, 32), &"wall")
	await create_timer(0.4).timeout
	assert(construction.get_completed_object_at(Vector2i(34, 32)) == &"wall")
	assert(supplies.get_total_quantity(&"wall_section") == initial_wall_sections)
	assert(supplies.get_loose_quantity(nearby_loose_cell, &"wall_section") == 0)

	var navigation: NavigationGrid = main.get_node("NavigationGrid")
	var initial_doors := supplies.get_total_quantity(&"door_module")
	construction.place_blueprint(Vector2i(34, 32), &"door")
	await create_timer(0.4).timeout
	assert(construction.get_completed_object_at(Vector2i(34, 32)) == &"door")
	assert(navigation.is_cell_walkable(Vector2i(34, 32)))
	assert(supplies.get_total_quantity(&"door_module") == initial_doors - 1)

	construction.mark_deconstruction_line(Vector2i(34, 32), Vector2i(34, 32))
	await create_timer(0.4).timeout
	assert(construction.get_completed_object_at(Vector2i(34, 32)).is_empty())

	var unreachable_target := Vector2i(40, 40)
	construction.place_blueprint(unreachable_target, &"wall")
	for offset in NavigationGrid.NEIGHBORS:
		navigation.register_construction(unreachable_target + offset, &"wall")
	construction.place_blueprint(Vector2i(36, 32), &"door")
	await create_timer(0.4).timeout
	assert(construction.get_completed_object_at(Vector2i(36, 32)) == &"door")
	assert(construction.get_blueprint_at(unreachable_target) == &"wall")
	assert(not construction.can_place_blueprint(unreachable_target, &"wall"))

	var batch_cells: Array[Vector2i] = [
		Vector2i(35, 35),
		Vector2i(36, 35),
		Vector2i(37, 35),
		Vector2i(35, 36),
	]
	var wall_sections_before_batch := supplies.get_total_quantity(
		&"wall_section"
	)
	var inventory_events := [0]
	supplies.inventory_changed.connect(
		func() -> void:
			inventory_events[0] += 1
	)
	for cell in batch_cells:
		construction.place_blueprint(cell, &"wall")
	await create_timer(1.0).timeout
	for cell in batch_cells:
		assert(construction.get_completed_object_at(cell) == &"wall")
	assert(
		supplies.get_total_quantity(&"wall_section")
		== wall_sections_before_batch - 4
	)
	assert(inventory_events[0] == 1)

	var occupied_cell := Vector2i(32, 38)
	var blocking_worker: WorkerAgent = workers.back()
	blocking_worker.set_process(false)
	blocking_worker.position = navigation.cell_to_world(Vector2i(30, 38))
	blocking_worker.state = WorkerAgent.State.MOVING_TO_JOB
	blocking_worker._path = [
		Vector2i(30, 38),
		Vector2i(31, 38),
		occupied_cell,
		Vector2i(33, 38),
	]
	blocking_worker._path_index = 1
	var alternate_cell := Vector2i(32, 39)
	construction.place_blueprint(occupied_cell, &"wall")
	construction.place_blueprint(alternate_cell, &"wall")
	await create_timer(0.5).timeout
	assert(construction.get_completed_object_at(occupied_cell).is_empty())
	assert(construction.get_blueprint_at(occupied_cell) == &"wall")
	assert(construction.get_completed_object_at(alternate_cell) == &"wall")
	blocking_worker._path.clear()
	blocking_worker.state = WorkerAgent.State.IDLE
	await create_timer(0.5).timeout
	assert(construction.get_completed_object_at(occupied_cell) == &"wall")
	blocking_worker.set_process(true)

	var idle_blueprint_cell := Vector2i(30, 40)
	blocking_worker.position = navigation.cell_to_world(idle_blueprint_cell)
	blocking_worker.state = WorkerAgent.State.WAITING_FOR_BUILD_CELL
	blocking_worker._path.clear()
	construction.place_blueprint(idle_blueprint_cell, &"wall")
	await create_timer(0.6).timeout
	assert(
		navigation.world_to_cell(blocking_worker.position)
		!= idle_blueprint_cell
	)
	assert(
		construction.get_completed_object_at(idle_blueprint_cell) == &"wall"
	)

	var cancelled_cell := Vector2i(31, 37)
	construction.place_blueprint(cancelled_cell, &"wall")
	assert(
		construction.stage_material(cancelled_cell, &"wall_section")
	)
	construction.erase_line(cancelled_cell, cancelled_cell)
	assert(
		supplies.get_loose_quantity(cancelled_cell, &"wall_section") == 1
	)

	print("Main scene tests passed")
	main.free()
	quit()
