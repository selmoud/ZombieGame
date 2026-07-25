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

	menu.construction_tool_selected.emit(&"wall")
	assert(construction.active_tool == &"wall")
	assert(zones.active_tool.is_empty())

	menu.cancel_tool_selected.emit()
	assert(zones.active_tool.is_empty())
	assert(construction.active_tool.is_empty())

	var worker: WorkerAgent = main.get_node("Agents/Worker")
	var clock: GameClock = main.get_node("GameClock")
	worker.construction_duration = 0.01
	clock.set_speed(4.0)
	construction.place_blueprint(Vector2i(34, 32), &"wall")
	await create_timer(0.4).timeout
	assert(construction.get_completed_object_at(Vector2i(34, 32)) == &"wall")

	var navigation: NavigationGrid = main.get_node("NavigationGrid")
	var unreachable_target := Vector2i(40, 40)
	construction.place_blueprint(unreachable_target, &"wall")
	for offset in NavigationGrid.NEIGHBORS:
		navigation.register_construction(unreachable_target + offset, &"wall")
	construction.place_blueprint(Vector2i(36, 32), &"door")
	await create_timer(0.4).timeout
	assert(construction.get_completed_object_at(Vector2i(36, 32)) == &"door")
	assert(construction.get_blueprint_at(unreachable_target) == &"wall")
	assert(not construction.can_place_blueprint(unreachable_target, &"wall"))

	print("Main scene tests passed")
	main.free()
	quit()
