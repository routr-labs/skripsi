from pathlib import Path


def test_frontend_checks_status_before_starting_browser_camera():
    source = Path("app/static/app.js").read_text()
    init_block = source[source.index("Init") :]

    assert "await loadStatus()" in init_block
    assert "if (!state.usbDeviceMode)" in init_block
    assert init_block.index("await loadStatus()") < init_block.index("startCamera()")


def test_frontend_tracks_usb_device_mode_from_status():
    source = Path("app/static/app.js").read_text()

    assert "usbDeviceMode" in source
    assert "data.app?.camera_source === 'usb'" in source


def test_frontend_streams_usb_preview_without_browser_camera():
    source = Path("app/static/app.js").read_text()
    init_block = source[source.index("Init") :]
    usb_init_block = init_block[init_block.index("startUsbPreview()") : init_block.index("// Show USB preview")]

    assert "startUsbPreview()" in init_block
    assert "document.createElement('img')" in source
    assert "const USB_PREVIEW_STREAM_URL = '/api/device-registration/preview.mjpg'" in source
    assert "/api/device-registration/preview.jpg?t=" not in source
    assert "URL.createObjectURL" not in source
    assert "setInterval(updatePreview" not in source
    assert "setAutoMode(false)" not in usb_init_block


def test_usb_scan_button_captures_visible_usb_preview_not_hidden_video():
    source = Path("app/static/app.js").read_text()
    capture_block = source[source.index("function captureFrame") : source.index("function triggerFlash")]
    scan_block = source[source.index("async function triggerScan") : source.index("async function handleScanUpload")]

    assert "naturalWidth" in capture_block
    assert "const scanSource = state.usbDeviceMode ? $('usbPreview') : video;" in scan_block
    assert "const b64 = captureFrame(scanSource);" in scan_block


def test_usb_registration_panel_has_camera_preview():
    html = Path("app/static/index.html").read_text()
    source = Path("app/static/app.js").read_text()

    assert "regCameraFrame" in html
    assert "usbRegistrationPreview" in html
    assert "usbRegistrationPreview" in source
    assert "syncUsbPreviewTarget()" in source
    assert "setUsbPreviewStream(usbRegistrationPreview" in source


def test_frontend_keeps_only_active_usb_preview_stream_connected():
    source = Path("app/static/app.js").read_text()
    switch_tab_block = source[source.index("function switchTab") : source.index("btnMode.addEventListener")]

    assert "syncUsbPreviewTarget()" in source
    assert "state.currentTab === 'scan'" in source
    assert "state.currentTab === 'register'" in source
    assert "img.removeAttribute('src')" in source
    assert "syncUsbPreviewTarget();" in switch_tab_block


def test_usb_quality_ui_uses_compact_action_line():
    source = Path("app/static/app.js").read_text()

    assert "function renderQualityLine(guidance)" in source
    assert "Show your full palm to the camera." in source
    assert "Adjust hand position." in source


def test_registration_ui_uses_selected_hand_flow_copy():
    html = Path("app/static/index.html").read_text()
    source = Path("app/static/app.js").read_text()

    assert "Follow 7 guided poses" not in html
    assert "Sample 1/7" not in html
    assert "0 / 7" not in html
    assert "Choose left, right, or both" in html
    assert "REGISTRATION_CAPTURES_PER_HAND = 5" in source
    assert "currentSampleIndex % REGISTRATION_CAPTURES_PER_HAND" in source


def test_browser_registration_sends_hand_labels():
    source = Path("app/static/app.js").read_text()

    assert "hands: state.capturedSamples.map((c) => c.hand)" in source
    assert "counts[hand] === REGISTRATION_CAPTURES_PER_HAND" in source
    assert "getCurrentRegistrationHand()" in source


def test_registration_ui_requires_and_sends_nim():
    html = Path("app/static/index.html").read_text()
    source = Path("app/static/app.js").read_text()

    assert "id=\"userNim\"" in html
    assert "const userNim" in source
    assert "body: JSON.stringify({ nim, name, hands: state.selectedHands })" in source
    assert "hasNim" in source


def test_registration_ui_has_camera_upload_mode_tabs():
    html = Path("app/static/index.html").read_text()

    assert "id=\"registrationModeTabs\"" in html
    assert "id=\"cameraRegistrationTab\"" in html
    assert "id=\"uploadRegistrationTab\"" in html
    assert "data-registration-mode=\"camera\"" in html
    assert "data-registration-mode=\"upload\"" in html
    assert "Camera capture" in html
    assert "Upload images" in html
    assert "id=\"cameraRegistrationPanel\"" in html
    assert "aria-labelledby=\"cameraRegistrationTab\"" in html
    assert "id=\"uploadRegistrationPanel\"" in html
    assert "aria-labelledby=\"uploadRegistrationTab\"" in html


def test_upload_registration_has_separate_left_right_pickers():
    html = Path("app/static/index.html").read_text()

    assert "id=\"uploadLeftFiles\"" in html
    assert "id=\"uploadRightFiles\"" in html
    assert "Left hand photos" in html
    assert "Right hand photos" in html
    assert "Select exactly 5 full-hand photos" in html
    assert "id=\"btnUploadRegister\"" in html
    assert "id=\"btnClearUploadFiles\"" in html


def test_upload_registration_sends_selected_full_photo_payload():
    source = Path("app/static/app.js").read_text()

    assert "async function finalizeUploadRegistration()" in source
    assert "function fileToDataUrl(file)" in source
    assert "const uploadImages = []" in source
    assert "const uploadHands = []" in source
    assert "images: uploadImages" in source
    assert "hands: uploadHands" in source
    assert "is_roi: false" in source


def test_registration_ui_has_optional_hand_chips():
    html = Path("app/static/index.html").read_text()
    source = Path("app/static/app.js").read_text()

    assert "id=\"registrationLeftHand\"" in html
    assert "id=\"registrationRightHand\"" in html
    assert "registration-hand-chip" in html
    assert "selectedHands" in source
    assert "function selectedRegistrationHands()" in source
    assert "function toggleRegistrationHand(hand)" in source


def test_browser_registration_uses_selected_hand_sequence():
    source = Path("app/static/app.js").read_text()

    assert "function getCurrentRegistrationSequence()" in source
    assert "const sequence = getCurrentRegistrationSequence();" in source
    assert "hands: state.selectedHands" in source
    assert "Registration started. Capture 5 samples for" in source


def test_upload_registration_uses_selected_hands_and_symmetric_actions():
    html = Path("app/static/index.html").read_text()
    css = Path("app/static/style.css").read_text()
    source = Path("app/static/app.js").read_text()

    assert "Selected hands need exactly 5 full-hand photos each." in html
    assert "const uploadHands = []" in source
    assert "hands: uploadHands" in source
    assert ".upload-register-actions" in css
    assert "grid-template-columns: 1fr 1fr" in css
    assert ".upload-register-actions .btn:first-child" not in css


def test_upload_registration_has_own_hand_selector():
    html = Path("app/static/index.html").read_text()
    upload_panel = html[html.index('id="uploadRegistrationPanel"') : html.index('id="uploadRegisterHint"')]

    assert 'id="uploadRegistrationLeftHand"' in upload_panel
    assert 'id="uploadRegistrationRightHand"' in upload_panel
    assert 'data-hand-toggle="left"' in upload_panel
    assert 'data-hand-toggle="right"' in upload_panel


def test_upload_action_grid_overrides_generic_register_actions():
    css = Path("app/static/style.css").read_text()

    assert ".upload-register-actions.register-actions" in css
    assert css.rindex(".upload-register-actions.register-actions") > css.rindex(".register-actions {")
    assert "width: 100%;" in css[css.rindex(".upload-register-actions.register-actions") :]


def test_upload_hand_selector_counts_use_uploaded_files():
    source = Path("app/static/app.js").read_text()
    upload_ui = source[source.index("function updateUploadRegistrationUI") : source.index("function clearUploadRegistration")]

    assert "uploadRegistrationLeftCount.textContent = uploadHandCountText('left')" in upload_ui
    assert "uploadRegistrationRightCount.textContent = uploadHandCountText('right')" in upload_ui
    assert "uploadInputForHand(hand).files.length" in source
    assert "return 'Off'" in source


def test_upload_register_button_ready_depends_on_upload_selection_only():
    source = Path("app/static/app.js").read_text()
    upload_ui = source[source.index("function updateUploadRegistrationUI") : source.index("function clearUploadRegistration")]

    assert "btnUploadRegister.disabled" in upload_ui
    assert "!uploadSelectionComplete()" in upload_ui
    assert "!hasNim" not in upload_ui
    assert "!hasName" not in upload_ui


def test_capture_guidance_uses_compact_quality_line():
    html = Path("app/static/index.html").read_text()
    source = Path("app/static/app.js").read_text()

    assert "id=\"registrationQualityLine\"" in html
    assert "id=\"qualityList\"" not in html
    assert "function renderQualityLine(guidance)" in source
    assert "function renderQualityList(guidance)" not in source


def test_upload_busy_disables_registration_controls():
    source = Path("app/static/app.js").read_text()
    mode_block = source[source.index("function setRegistrationMode") : source.index("function uploadFiles")]
    ui_block = source[source.index("function updateRegistrationUI") : source.index("function renderQualityLine")]

    assert "if (state.registrationActive || state.uploadBusy) return;" in mode_block
    assert "const busy = state.uploadBusy;" in ui_block
    assert "tab.disabled = active || busy;" in ui_block
    assert "btnStartRegistration.disabled = active || busy || !hasNim || !hasName" in ui_block
    assert "btnCaptureSample.disabled = !active || busy || !(state.lastGuidance?.acceptable)" in ui_block
    assert "btnFinalizeRegistration.disabled = !active || busy || !isRegistrationComplete()" in ui_block
    assert "btnCancelRegistration.disabled = !active || busy" in ui_block


def test_browser_camera_sends_full_frames_for_server_roi():
    source = Path("app/static/app.js").read_text()
    submit_block = source[source.index("async function submitRecognitionImage") : source.index("async function triggerScan")]
    scan_block = source[source.index("async function triggerScan") : source.index("function showScanning")]
    capture_block = source[source.index("function captureBrowserSample") : source.index("async function finalizeBrowserRegistration")]
    finalize_block = source[source.index("async function finalizeBrowserRegistration") : source.index("function updateRegistrationUI")]

    assert "extractClientROI" not in source
    assert "const scanSource = state.usbDeviceMode ? $('usbPreview') : video;" in scan_block
    assert "const b64 = captureFrame(scanSource);" in scan_block
    assert "body: JSON.stringify({ image: b64, is_roi: false" in submit_block
    assert "b64 = captureFrame(videoReg);" in capture_block
    assert "is_roi: false" in finalize_block


def test_frontend_displays_nim_with_user_name():
    source = Path("app/static/app.js").read_text()

    assert "${esc(u.nim)}" in source
    assert "${esc(u.name)}" in source


def test_scan_panel_has_dev_upload_and_roi_preview_ui():
    html = Path("app/static/index.html").read_text()
    css = Path("app/static/style.css").read_text()

    assert "id=\"scanUploadFile\"" in html
    assert "id=\"scanUploadLabel\"" in html
    assert "Upload photo" in html
    assert "id=\"roiPreview\"" in html
    assert "id=\"roiPreviewImage\"" in html
    assert "ROI used for embedding" in html
    assert ".dev-only[hidden]" in css
    assert ".roi-preview" in css


def test_upload_registration_tab_is_dev_only():
    html = Path("app/static/index.html").read_text()
    upload_tab = html[html.index('id="uploadRegistrationTab"') : html.index('id="uploadRegistrationPanel"')]

    assert "dev-only" in upload_tab


def test_frontend_tracks_dev_features_from_status():
    source = Path("app/static/app.js").read_text()

    assert "devFeatures: false" in source
    assert "data.app?.dev_features === true" in source
    assert "function updateDevFeatures()" in source
    assert "document.querySelectorAll('.dev-only')" in source
    assert "scanUploadLabel?.setAttribute('aria-disabled', String(!state.devFeatures))" in source
    assert "state.registrationMode === 'upload'" in source

    # Assert exact upload mode guard string
    assert "if (mode === 'upload' && !state.devFeatures) return;" in source

    # Assert updateUploadRegistrationUI disables upload registration with devFeatures guard
    upload_ui_block = source[source.index("function updateUploadRegistrationUI") : source.index("function clearUploadRegistration")]
    assert "|| !state.devFeatures" in upload_ui_block
    assert "btnUploadRegister.disabled = (" in upload_ui_block


def test_frontend_sends_debug_roi_and_renders_roi_preview():
    source = Path("app/static/app.js").read_text()

    assert "debug_roi: state.devFeatures" in source
    assert "function updateRoiPreview(data)" in source
    assert "roiPreviewImage.src = data.roi_image" in source
    assert "function clearRoiPreview()" in source
    assert "scanUploadFile?.addEventListener('change', handleScanUpload)" in source

    upload_block = source[
        source.index("async function handleScanUpload") : source.index("function clearRoiPreview")
    ]
    busy_guard = upload_block[
        upload_block.index("if (state.scanBusy)") : upload_block.index("state.scanBusy = true")
    ]
    assert "scanUploadFile.value = '';" in busy_guard
    assert busy_guard.index("scanUploadFile.value = '';") < busy_guard.index("return;")


def test_dev_features_do_not_auto_show_empty_roi_preview():
    source = Path("app/static/app.js").read_text()
    block = source[source.index("function updateDevFeatures") : source.index("async function loadStatus")]

    assert "if (el === roiPreview && state.devFeatures) return;" in block


def test_upload_registration_sends_upload_source():
    source = Path("app/static/app.js").read_text()
    upload_block = source[source.index("async function finalizeUploadRegistration") : source.index("function resetRegistration")]

    assert "source: 'upload'" in upload_block


def test_device_status_card_shows_app_version():
    html = Path("app/static/index.html").read_text()
    source = Path("app/static/app.js").read_text()

    assert 'id="appVersion"' in html
    assert "$('appVersion').textContent = data.app?.version ?? 'local';" in source
