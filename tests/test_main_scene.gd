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

	print("Main scene tests passed")
	main.free()
	quit()
