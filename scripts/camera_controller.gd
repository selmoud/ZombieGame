class_name CameraController
extends Camera2D

const WORLD_SIZE := Vector2(64 * 32, 64 * 32)
const MIN_ZOOM := 0.75
const MAX_ZOOM := 2.0
const ZOOM_STEP := 0.125

@export var movement_speed := 720.0

var _dragging := false


func _ready() -> void:
	make_current()


func _process(delta: float) -> void:
	var direction := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		direction.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		direction.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		direction.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		direction.y += 1.0

	if direction != Vector2.ZERO:
		position += direction.normalized() * movement_speed * delta / zoom.x
		_clamp_position()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_MIDDLE:
			_dragging = event.pressed
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_change_zoom(ZOOM_STEP)
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_change_zoom(-ZOOM_STEP)
	elif event is InputEventMouseMotion and _dragging:
		position -= event.relative / zoom.x
		_clamp_position()


func _change_zoom(amount: float) -> void:
	var next_zoom := clampf(zoom.x + amount, MIN_ZOOM, MAX_ZOOM)
	zoom = Vector2.ONE * next_zoom
	_clamp_position()


func _clamp_position() -> void:
	var half_viewport := get_viewport_rect().size * 0.5 / zoom
	position.x = clampf(position.x, half_viewport.x, WORLD_SIZE.x - half_viewport.x)
	position.y = clampf(position.y, half_viewport.y, WORLD_SIZE.y - half_viewport.y)
