extends Node
## Saves one frame to the path given in the SHOT_PATH environment variable and quits.
## Does nothing in normal runs. Used by /usr/local/bin/claude-godot-shot.

const DEFAULT_FRAMES := 10


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
	await RenderingServer.frame_post_draw
	var error := get_viewport().get_texture().get_image().save_png(path)
	if error != OK:
		push_error("ScreenshotHook: cannot save %s (error %d)" % [path, error])
	get_tree().quit(0 if error == OK else 1)
