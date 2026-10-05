class_name TestCase
extends RefCounted
## Base class for tests. Put a file named tests/test_*.gd that extends TestCase
## and add methods named test_*. Failed checks are collected, not thrown,
## so a failing test never hangs the process.

var failures: PackedStringArray = []
## Scene tree of the runner; use it to add nodes and await frames.
var tree: SceneTree


func check(condition: bool, message: String = "") -> void:
	if not condition:
		_fail(message if not message.is_empty() else "condition is false")


func check_eq(actual: Variant, expected: Variant, message: String = "") -> void:
	if typeof(actual) != typeof(expected) or actual != expected:
		var text := "expected %s, got %s" % [var_to_str(expected), var_to_str(actual)]
		_fail(text if message.is_empty() else "%s: %s" % [message, text])


func _fail(message: String) -> void:
	var frame: Dictionary = {}
	for candidate: Dictionary in get_stack():
		if candidate.source != (get_script() as Script).resource_path:
			continue
		frame = candidate
		break
	if frame.is_empty():
		failures.append(message)
	else:
		failures.append("%s (line %d)" % [message, frame.line])
