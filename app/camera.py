import cv2


class OpenCVCameraSource:
    def __init__(self, device_source: int | str = 0):
        device_source = int(device_source) if isinstance(device_source, str) and device_source.isdigit() else device_source
        self.capture = cv2.VideoCapture(device_source)
        if not self.capture.isOpened():
            raise RuntimeError(f"Failed to open camera device {device_source}")
        self.capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    def read(self):
        for _ in range(2):
            self.capture.grab()
        ok, frame = self.capture.retrieve()
        if not ok or frame is None:
            ok, frame = self.capture.read()
        if not ok or frame is None:
            raise RuntimeError("Failed to read frame from camera")
        return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    def close(self):
        self.capture.release()
