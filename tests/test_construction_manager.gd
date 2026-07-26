extends SceneTree


func _init() -> void:
	var construction := ConstructionManager.new()

	assert(ConstructionCatalog.get_required_item(&"wall") == &"wall_section")
	assert(ConstructionCatalog.get_required_item(&"door") == &"door_module")
	assert(ConstructionCatalog.get_required_item(&"barricade") == &"debris")
	assert(
		ConstructionCatalog.get_cells_for_footprint(
			Vector2i(3, 1),
			Vector2i(4, 5),
			1
		) == [
			Vector2i(4, 5),
			Vector2i(4, 6),
			Vector2i(4, 7),
		]
	)
	var instance := BuildableInstance.new(&"wall", Vector2i(6, 6), 3)
	assert(instance.anchor == Vector2i(6, 6))
	assert(instance.object_id == &"wall")
	assert(instance.rotation_quarters == 3)
	assert(instance.occupies(Vector2i(6, 6)))

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

	assert(
		construction.stage_material(Vector2i(0, 0), &"wall_section")
	)
	assert(not construction.stage_material(Vector2i(0, 0), &"wall_section"))
	assert(construction.complete_blueprint(Vector2i(0, 0)))
	assert(construction.get_blueprint_at(Vector2i(0, 0)).is_empty())
	assert(construction.get_completed_object_at(Vector2i(0, 0)) == &"wall")
	assert(not construction.complete_blueprint(Vector2i(0, 0)))
	assert(construction.can_place_blueprint(Vector2i(0, 0), &"door"))
	assert(not construction.can_place_blueprint(Vector2i(0, 0), &"wall"))
	construction.place_blueprint(Vector2i(0, 0), &"door")
	assert(construction.stage_material(Vector2i(0, 0), &"door_module"))
	assert(construction.complete_blueprint(Vector2i(0, 0)))
	assert(construction.get_completed_object_at(Vector2i(0, 0)) == &"door")

	assert(
		construction.stage_material(Vector2i(1, 0), &"wall_section")
	)
	assert(construction.complete_blueprint(Vector2i(1, 0)))
	construction.mark_deconstruction_line(Vector2i(1, 0), Vector2i(1, 0))
	assert(construction.get_deconstruction_cells() == [Vector2i(1, 0)])
	assert(construction.complete_deconstruction(Vector2i(1, 0)))
	assert(construction.get_completed_object_at(Vector2i(1, 0)).is_empty())
	assert(not construction.complete_deconstruction(Vector2i(1, 0)))

	var released_materials: Array[Dictionary] = []
	construction.material_released.connect(
		func(cell: Vector2i, item_id: StringName, quantity: int) -> void:
			released_materials.append({
				"cell": cell,
				"item_id": item_id,
				"quantity": quantity,
			})
	)
	assert(
		construction.stage_material(Vector2i(2, 0), &"wall_section")
	)
	construction.erase_line(Vector2i(2, 0), Vector2i(2, 0))
	assert(released_materials.size() == 1)
	assert(released_materials[0]["item_id"] == &"wall_section")

	assert(not construction.can_place_blueprint(Vector2i(-1, 0), &"wall"))
	assert(construction.can_place_blueprint(Vector2i(1, 1), &"wall"))
	construction.set_placement_validator(
		func(cell: Vector2i) -> bool:
			return cell != Vector2i(1, 1)
	)
	assert(not construction.can_place_blueprint(Vector2i(1, 1), &"wall"))
	assert(construction.can_place_blueprint(Vector2i(2, 1), &"wall"))
	construction.place_blueprint(Vector2i(2, 1), &"wall")
	assert(construction.stage_material(Vector2i(2, 1), &"wall_section"))
	assert(construction.complete_blueprint(Vector2i(2, 1)))
	construction.set_placement_validator(
		func(_cell: Vector2i) -> bool:
			return false
	)
	assert(construction.can_mark_for_deconstruction(Vector2i(2, 1)))
	construction.mark_deconstruction_line(Vector2i(2, 1), Vector2i(2, 1))
	assert(construction.get_deconstruction_cells() == [Vector2i(2, 1)])
	assert(construction.complete_deconstruction(Vector2i(2, 1)))

	construction.set_placement_validator(Callable())
	construction.set_active_tool(&"bunk_bed")
	assert(construction.get_active_rotation_quarters() == 0)
	construction.rotate_active_tool()
	assert(construction.get_active_rotation_quarters() == 1)
	construction.place_blueprint(Vector2i(12, 12), &"bunk_bed", 1)
	assert(construction.get_blueprint_at(Vector2i(12, 12)) == &"bunk_bed")
	assert(construction.get_blueprint_at(Vector2i(13, 12)) == &"bunk_bed")
	assert(
		construction.get_blueprint_occupied_cells(Vector2i(13, 12))
		== [Vector2i(12, 12), Vector2i(13, 12)]
	)
	assert(
		not construction.can_place_blueprint(
			Vector2i(13, 12),
			&"toilet"
		)
	)
	assert(construction.stage_material(Vector2i(13, 12), &"bunk_bed"))
	assert(construction.complete_blueprint(Vector2i(12, 12)))
	assert(
		construction.get_completed_object_at(Vector2i(13, 12))
		== &"bunk_bed"
	)
	construction.mark_deconstruction_line(
		Vector2i(13, 12),
		Vector2i(13, 12)
	)
	assert(construction.get_deconstruction_cells() == [Vector2i(12, 12)])
	assert(construction.complete_deconstruction(Vector2i(13, 12)))
	assert(
		construction.get_completed_object_at(Vector2i(12, 12)).is_empty()
	)
	assert(
		not construction.can_place_blueprint(
			Vector2i(WorldConfig.MAP_SIZE.x - 2, 5),
			&"food_table"
		)
	)
	assert(construction.has_valid_state())

	print("ConstructionManager tests passed")
	construction.free()
	quit()
