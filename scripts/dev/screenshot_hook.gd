extends Node
## Saves one frame to the path given in the SHOT_PATH environment variable and quits.
## Does nothing in normal runs. Used by /usr/local/bin/claude-godot-shot.
##
## To capture a particular state, put a script at SETUP_SCRIPT with
## `static func run(tree: SceneTree) -> void`; it is called before the capture.
## The .tools folder is not in git, so the script never ships with the game.

const DEFAULT_FRAMES := 10
const SETUP_SCRIPT := "res://.tools/shot_setup.gd"


func _ready() -> void:
	var path := OS.get_environment("SHOT_PATH")
	if path.is_empty() or DisplayServer.get_name() == "headless":
		return
	_capture.call_deferred(path)


func _capture(path: String) -> void:
	var frames := OS.get_environment("SHOT_FRAMES").to_int()
	if frames <= 0:
		frames = DEFAULT_FRAMES
	for i in frames:
		await get_tree().process_frame
	if FileAccess.file_exists(SETUP_SCRIPT):
		var setup: GDScript = load(SETUP_SCRIPT)
		await setup.run(get_tree())
		for i in 3:
			await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var error := get_viewport().get_texture().get_image().save_png(path)
	if error != OK:
		push_error("ScreenshotHook: cannot save %s (error %d)" % [path, error])
	get_tree().quit(0 if error == OK else 1)
