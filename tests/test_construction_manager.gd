extends SceneTree


func _init() -> void:
	var construction := ConstructionManager.new()

	construction.place_line(Vector2i(2, 4), Vector2i(5, 5), &"wall")
	assert(construction.get_blueprint_count(&"wall") == 4)
	assert(construction.get_blueprint_at(Vector2i(5, 4)) == &"wall")

	construction.place_line(Vector2i(8, 7), Vector2i(7, 3), &"barricade")
	assert(construction.get_blueprint_count(&"barricade") == 5)
	assert(construction.get_blueprint_at(Vector2i(8, 3)) == &"barricade")

	construction.place_blueprint(Vector2i(5, 4), &"door")
	assert(construction.get_blueprint_at(Vector2i(5, 4)) == &"door")
	assert(construction.get_blueprint_count(&"wall") == 3)

	construction.erase_line(Vector2i(3, 4), Vector2i(5, 4))
	assert(construction.get_blueprint_at(Vector2i(3, 4)).is_empty())
	assert(construction.get_blueprint_at(Vector2i(5, 4)).is_empty())

	construction.place_line(Vector2i(-2, 0), Vector2i(2, 0), &"wall")
	assert(construction.get_blueprint_at(Vector2i(-1, 0)).is_empty())
	assert(construction.get_blueprint_at(Vector2i(0, 0)) == &"wall")

	assert(construction.complete_blueprint(Vector2i(0, 0)))
	assert(construction.get_blueprint_at(Vector2i(0, 0)).is_empty())
	assert(construction.get_completed_object_at(Vector2i(0, 0)) == &"wall")
	assert(not construction.complete_blueprint(Vector2i(0, 0)))
	assert(construction.can_place_blueprint(Vector2i(0, 0), &"door"))
	assert(not construction.can_place_blueprint(Vector2i(0, 0), &"wall"))
	construction.place_blueprint(Vector2i(0, 0), &"door")
	assert(construction.complete_blueprint(Vector2i(0, 0)))
	assert(construction.get_completed_object_at(Vector2i(0, 0)) == &"door")

	assert(construction.complete_blueprint(Vector2i(1, 0)))
	construction.mark_deconstruction_line(Vector2i(1, 0), Vector2i(1, 0))
	assert(construction.get_deconstruction_cells() == [Vector2i(1, 0)])
	assert(construction.complete_deconstruction(Vector2i(1, 0)))
	assert(construction.get_completed_object_at(Vector2i(1, 0)).is_empty())
	assert(not construction.complete_deconstruction(Vector2i(1, 0)))

	assert(not construction.can_place_blueprint(Vector2i(-1, 0), &"wall"))
	assert(construction.can_place_blueprint(Vector2i(1, 1), &"wall"))
	construction.set_placement_validator(
		func(cell: Vector2i) -> bool:
			return cell != Vector2i(1, 1)
	)
	assert(not construction.can_place_blueprint(Vector2i(1, 1), &"wall"))
	assert(construction.can_place_blueprint(Vector2i(2, 1), &"wall"))

	print("ConstructionManager tests passed")
	construction.free()
	quit()
