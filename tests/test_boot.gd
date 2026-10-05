extends TestCase


func test_main_scene_is_configured() -> void:
	var path: String = ProjectSettings.get_setting("application/run/main_scene")
	check(ResourceLoader.exists(path), "main scene %s does not exist" % path)


func test_boot_scene_shows_project_name() -> void:
	var scene: PackedScene = load("res://scenes/boot.tscn")
	var boot: Control = scene.instantiate()
	tree.root.add_child(boot)
	await tree.process_frame

	var title: Label = boot.get_node("%Title")
	check_eq(title.text, ProjectSettings.get_setting("application/config/name"))
	var version: Label = boot.get_node("%Version")
	check(version.text.begins_with("Godot 4."), "unexpected version text: %s" % version.text)

	boot.queue_free()
	await tree.process_frame
