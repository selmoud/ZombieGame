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

	print("ConstructionManager tests passed")
	construction.free()
	quit()
