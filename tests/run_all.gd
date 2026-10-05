extends SceneTree
## Runs every test_* method of every tests/test_*.gd script.
## Usage: godot --headless --path . --script res://tests/run_all.gd
## Exit code 0 when all tests pass, 1 otherwise.

const TESTS_DIR := "res://tests"
const BASE_SCRIPT := "test_case.gd"


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var failed := 0
	var total := 0
	for file in _find_test_files():
		var script: GDScript = load("%s/%s" % [TESTS_DIR, file])
		if script == null:
			failed += 1
			total += 1
			print("FAIL %s: script does not load" % file)
			continue
		for method in _find_test_methods(script):
			var test: TestCase = script.new()
			test.tree = self
			total += 1
			await test.call(method)
			if test.failures.is_empty():
				print("ok   %s.%s" % [file, method])
			else:
				failed += 1
				print("FAIL %s.%s" % [file, method])
				for failure in test.failures:
					print("       %s" % failure)
	print("%d tests, %d failed" % [total, failed])
	quit(1 if failed > 0 or total == 0 else 0)


func _find_test_files() -> PackedStringArray:
	var files: PackedStringArray = []
	for file in DirAccess.get_files_at(TESTS_DIR):
		if file.begins_with("test_") and file.ends_with(".gd") and file != BASE_SCRIPT:
			files.append(file)
	files.sort()
	return files


func _find_test_methods(script: GDScript) -> PackedStringArray:
	var methods: PackedStringArray = []
	for method in script.get_script_method_list():
		if (method.name as String).begins_with("test_"):
			methods.append(method.name)
	return methods
