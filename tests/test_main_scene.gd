extends SceneTree


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var packed_scene: PackedScene = load("res://scenes/main.tscn")
	var main := packed_scene.instantiate()
	root.add_child(main)
	await process_frame

	var zones: ZoneManager = main.get_node("ZoneLayer")
	var menu: BuildMenu = main.get_node("Interface/BuildMenu")

	menu.zone_tool_selected.emit(&"residential")
	assert(zones.active_tool == &"residential")

	menu.cancel_tool_selected.emit()
	assert(zones.active_tool.is_empty())

	print("Main scene tests passed")
	main.free()
	quit()
