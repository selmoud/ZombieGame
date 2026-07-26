extends SceneTree


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var navigation := NavigationGrid.new()
	root.add_child(navigation)
	await process_frame

	var target := Vector2i(10, 10)
	var diagonal_path := navigation.get_cell_path(
		Vector2i(1, 1),
		Vector2i(4, 4)
	)
	assert(diagonal_path == [
		Vector2i(1, 1),
		Vector2i(2, 2),
		Vector2i(3, 3),
		Vector2i(4, 4),
	])

	navigation.register_construction(Vector2i(2, 1), &"wall")
	navigation.register_construction(Vector2i(1, 2), &"wall")
	var path_around_corner := navigation.get_cell_path(
		Vector2i(1, 1),
		Vector2i(2, 2)
	)
	assert(path_around_corner.size() > 2)
	assert(path_around_corner[1] != Vector2i(2, 2))

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

	var furniture_cell := Vector2i(20, 20)
	navigation.register_construction(furniture_cell, &"single_bed")
	assert(not navigation.is_cell_walkable(furniture_cell))
	navigation.remove_construction(furniture_cell, &"single_bed")
	assert(navigation.is_cell_walkable(furniture_cell))
	navigation.register_construction(furniture_cell, &"sleeping_bag")
	assert(navigation.is_cell_walkable(furniture_cell))

	print("NavigationGrid tests passed")
	navigation.free()
	quit()
