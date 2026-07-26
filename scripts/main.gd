extends Node2D

@onready var game_clock: GameClock = $GameClock
@onready var zone_manager: ZoneManager = $ZoneLayer
@onready var construction_manager: ConstructionManager = $ConstructionLayer
@onready var supplies: SupplyDepot = $SupplyDepot
@onready var navigation_grid: NavigationGrid = $NavigationGrid
@onready var job_board: JobBoard = $JobBoard
@onready var agents: Node2D = $Agents
@onready var build_menu: BuildMenu = $Interface/BuildMenu

var workers: Array[WorkerAgent] = []
var selected_worker: WorkerAgent
var worker_inspector_panel: PanelContainer
var worker_inspector_label: Label


func _process(_delta: float) -> void:
	if selected_worker == null or not is_instance_valid(selected_worker):
		return
	worker_inspector_label.text = selected_worker.get_inspector_text()


func _input(event: InputEvent) -> void:
	if (
		event is InputEventKey
		and event.keycode == KEY_ESCAPE
		and event.pressed
		and not event.echo
		and selected_worker != null
	):
		_clear_worker_selection()
		get_viewport().set_input_as_handled()


func _ready() -> void:
	_create_hud()
	build_menu.zone_tool_selected.connect(_select_zone_tool)
	build_menu.construction_tool_selected.connect(_select_construction_tool)
	build_menu.cancel_tool_selected.connect(_clear_planning_tools)
	zone_manager.active_tool_changed.connect(build_menu.sync_active_tool)
	construction_manager.active_tool_changed.connect(build_menu.sync_construction_tool)
	construction_manager.blueprints_changed.connect(_sync_construction_jobs)
	construction_manager.deconstruction_orders_changed.connect(
		_sync_deconstruction_jobs
	)
	construction_manager.construction_completed.connect(
		navigation_grid.register_construction
	)
	construction_manager.construction_removed.connect(
		navigation_grid.remove_construction
	)
	construction_manager.material_released.connect(
		supplies.drop_loose_items
	)
	zone_manager.set_boundary_provider(
		construction_manager.get_completed_object_at
	)
	construction_manager.construction_completed.connect(
		zone_manager.refresh_boundaries
	)
	construction_manager.construction_removed.connect(
		zone_manager.refresh_boundaries
	)
	for child in agents.get_children():
		if child is not WorkerAgent:
			continue
		var worker := child as WorkerAgent
		workers.append(worker)
		worker.inspection_requested.connect(_select_worker)
		worker.setup(
			game_clock,
			navigation_grid,
			job_board,
			construction_manager,
			supplies
		)
	construction_manager.set_placement_validator(
		_can_worker_reach_construction_cell
	)
	_sync_construction_jobs()
	_sync_deconstruction_jobs()


func _select_zone_tool(tool_id: StringName) -> void:
	construction_manager.clear_active_tool()
	zone_manager.set_active_tool(tool_id)


func _select_construction_tool(tool_id: StringName) -> void:
	zone_manager.clear_active_tool()
	construction_manager.set_active_tool(tool_id)


func _clear_planning_tools() -> void:
	zone_manager.clear_active_tool()
	construction_manager.clear_active_tool()


func _select_worker(worker: WorkerAgent) -> void:
	if selected_worker != null and is_instance_valid(selected_worker):
		selected_worker.set_inspected(false)
	selected_worker = worker
	selected_worker.set_inspected(true)
	worker_inspector_label.text = selected_worker.get_inspector_text()
	worker_inspector_panel.visible = true


func _clear_worker_selection() -> void:
	if selected_worker != null and is_instance_valid(selected_worker):
		selected_worker.set_inspected(false)
	selected_worker = null
	worker_inspector_panel.visible = false


func _sync_construction_jobs() -> void:
	job_board.sync_construction_jobs(construction_manager.get_blueprint_cells())


func _sync_deconstruction_jobs() -> void:
	job_board.sync_deconstruction_jobs(
		construction_manager.get_deconstruction_cells()
	)


func _can_worker_reach_construction_cell(cell: Vector2i) -> bool:
	if supplies.has_box_at(cell):
		return false
	for worker in workers:
		var worker_cell := navigation_grid.world_to_cell(worker.position)
		if not navigation_grid.find_path_to_adjacent(
			worker_cell,
			cell
		).is_empty():
			return true
	return false


func _create_hud() -> void:
	var canvas := CanvasLayer.new()
	canvas.name = "HUD"
	canvas.layer = 2
	add_child(canvas)

	var panel := PanelContainer.new()
	panel.position = Vector2(16, 16)
	panel.custom_minimum_size = Vector2(410, 106)
	canvas.add_child(panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 10)
	panel.add_child(margin)

	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", 8)
	margin.add_child(layout)

	var date_label := Label.new()
	date_label.name = "DateLabel"
	date_label.text = game_clock.get_date_text()
	layout.add_child(date_label)

	var supplies_label := Label.new()
	supplies_label.text = supplies.get_summary_text()
	supplies_label.add_theme_color_override(
		"font_color",
		Color(0.82, 0.8, 0.7)
	)
	layout.add_child(supplies_label)

	var controls := HBoxContainer.new()
	controls.add_theme_constant_override("separation", 6)
	layout.add_child(controls)

	var speeds: Array[float] = [0.0, 1.0, 2.0, 4.0]
	var captions: Array[String] = ["Пауза", "×1", "×2", "×4"]
	for index in speeds.size():
		var button := Button.new()
		button.text = captions[index]
		button.focus_mode = Control.FOCUS_NONE
		button.pressed.connect(game_clock.set_speed.bind(speeds[index]))
		controls.add_child(button)

	var help := Label.new()
	help.text = "WASD/стрелки — камера  •  колёсико — масштаб  •  Space — пауза"
	help.position = Vector2(16, 136)
	help.add_theme_color_override("font_color", Color(0.9, 0.92, 0.86, 0.9))
	canvas.add_child(help)

	worker_inspector_panel = PanelContainer.new()
	worker_inspector_panel.name = "WorkerInspector"
	worker_inspector_panel.anchor_left = 1.0
	worker_inspector_panel.anchor_right = 1.0
	worker_inspector_panel.offset_left = -360.0
	worker_inspector_panel.offset_top = 16.0
	worker_inspector_panel.offset_right = -16.0
	worker_inspector_panel.offset_bottom = 220.0
	worker_inspector_panel.visible = false
	canvas.add_child(worker_inspector_panel)

	var inspector_margin := MarginContainer.new()
	inspector_margin.name = "Content"
	inspector_margin.add_theme_constant_override("margin_left", 14)
	inspector_margin.add_theme_constant_override("margin_top", 12)
	inspector_margin.add_theme_constant_override("margin_right", 14)
	inspector_margin.add_theme_constant_override("margin_bottom", 12)
	worker_inspector_panel.add_child(inspector_margin)

	worker_inspector_label = Label.new()
	worker_inspector_label.name = "Details"
	worker_inspector_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	worker_inspector_label.add_theme_color_override(
		"font_color",
		Color(0.92, 0.92, 0.86)
	)
	inspector_margin.add_child(worker_inspector_label)

	game_clock.time_changed.connect(
		func(_day: int, _hour: int, _minute: int) -> void:
			date_label.text = game_clock.get_date_text()
	)
	game_clock.speed_changed.connect(
		func(_speed: float) -> void:
			date_label.text = game_clock.get_date_text()
	)
	supplies.inventory_changed.connect(
		func() -> void:
			supplies_label.text = supplies.get_summary_text()
	)
