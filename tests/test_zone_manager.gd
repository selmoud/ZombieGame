extends SceneTree


func _init() -> void:
	var zones := ZoneManager.new()

	zones.paint_rect(Vector2i(2, 3), Vector2i(4, 4), &"residential")
	assert(zones.get_zone_count(&"residential") == 6)
	assert(zones.get_zone_at(Vector2i(3, 3)) == &"residential")

	zones.paint_rect(Vector2i(4, 4), Vector2i(5, 5), &"quarantine")
	assert(zones.get_zone_count(&"residential") == 5)
	assert(zones.get_zone_count(&"quarantine") == 4)

	zones.erase_rect(Vector2i(3, 3), Vector2i(4, 4))
	assert(zones.get_zone_at(Vector2i(3, 3)).is_empty())
	assert(zones.get_zone_at(Vector2i(4, 4)).is_empty())

	zones.paint_rect(Vector2i(-2, -2), Vector2i.ZERO, &"storage")
	assert(zones.get_zone_count(&"storage") == 1)

	var room_zones := ZoneManager.new()
	var boundaries: Dictionary[Vector2i, StringName] = {
		Vector2i(4, 5): &"wall",
		Vector2i(7, 5): &"wall",
		Vector2i(5, 4): &"door",
		Vector2i(6, 4): &"wall",
		Vector2i(5, 6): &"wall",
		Vector2i(6, 6): &"wall",
	}
	room_zones.set_boundary_provider(
		func(cell: Vector2i) -> StringName:
			return boundaries.get(cell, &"")
	)
	room_zones.paint_rect(Vector2i(5, 5), Vector2i(6, 5), &"residential")
	assert(room_zones.get_area_count(&"residential") == 1)
	assert(room_zones.is_room_valid_at(Vector2i(5, 5)))
	var room_status := room_zones.get_room_status_at(Vector2i(5, 5))
	assert(room_status["is_connected"])
	assert(room_status["is_enclosed"])
	assert(room_status["has_door"])

	boundaries.erase(Vector2i(6, 6))
	assert(not room_zones.is_room_valid_at(Vector2i(5, 5)))
	boundaries[Vector2i(6, 6)] = &"wall"

	room_zones.paint_rect(Vector2i(7, 6), Vector2i(7, 6), &"residential")
	assert(room_zones.get_area_count(&"residential") == 2)

	print("ZoneManager tests passed")
	room_zones.free()
	zones.free()
	quit()
