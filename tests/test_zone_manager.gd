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

	print("ZoneManager tests passed")
	zones.free()
	quit()
