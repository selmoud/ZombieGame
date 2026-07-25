extends SceneTree


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var navigation := NavigationGrid.new()
	root.add_child(navigation)
	await process_frame

	var target := Vector2i(10, 10)
	navigation.register_construction(Vector2i(9, 10), &"wall")
	navigation.register_construction(Vector2i(11, 10), &"wall")
	navigation.register_construction(Vector2i(10, 9), &"wall")
	navigation.register_construction(Vector2i(10, 11), &"wall")

	var path := navigation.find_path_to_adjacent(Vector2i(7, 7), target)
	assert(not path.is_empty())
	assert(path.back() == Vector2i(9, 9))

	navigation.register_construction(Vector2i(9, 9), &"wall")
	navigation.register_construction(Vector2i(11, 9), &"wall")
	navigation.register_construction(Vector2i(9, 11), &"wall")
	navigation.register_construction(Vector2i(11, 11), &"wall")
	assert(
		navigation.find_path_to_adjacent(Vector2i(7, 7), target).is_empty()
	)

	print("NavigationGrid tests passed")
	navigation.free()
	quit()
