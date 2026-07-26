extends SceneTree


func _init() -> void:
	var jobs := JobBoard.new()
	jobs.sync_construction_jobs([
		Vector2i(2, 2),
		Vector2i(8, 8),
		Vector2i(4, 3),
	])

	assert(jobs.get_construction_job_count() == 3)
	var claimed := jobs.get_available_construction_jobs(Vector2i(3, 3))[0]
	assert(jobs.claim_construction(claimed, 10))
	assert(claimed == Vector2i(4, 3))

	var second_claim := jobs.get_available_construction_jobs(Vector2i(3, 3))[0]
	assert(jobs.claim_construction(second_claim, 11))
	assert(second_claim == Vector2i(2, 2))

	jobs.release_construction(claimed, 10)
	assert(jobs.get_available_construction_jobs(Vector2i(4, 4))[0] == claimed)
	assert(jobs.claim_construction(claimed, 12))

	jobs.sync_construction_jobs([Vector2i(8, 8)])
	assert(jobs.get_construction_job_count() == 1)
	var available := jobs.get_available_construction_jobs(Vector2i.ZERO)
	assert(available == [Vector2i(8, 8)])
	assert(jobs.claim_construction(Vector2i(8, 8), 20))
	assert(not jobs.claim_construction(Vector2i(8, 8), 21))

	jobs.sync_deconstruction_jobs([Vector2i(5, 5), Vector2i(10, 10)])
	assert(jobs.get_deconstruction_job_count() == 2)
	assert(
		jobs.get_available_deconstruction_jobs(Vector2i(4, 4)).front()
		== Vector2i(5, 5)
	)
	assert(jobs.claim_deconstruction(Vector2i(5, 5), 30))
	assert(not jobs.claim_deconstruction(Vector2i(5, 5), 31))
	jobs.complete_deconstruction(Vector2i(5, 5), 30)
	assert(not jobs.has_deconstruction_job(Vector2i(5, 5)))

	print("JobBoard tests passed")
	jobs.free()
	quit()
