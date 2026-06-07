import io
from google.auth import default
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]
_drive_service = None


def _get_drive_service():
    global _drive_service
    if _drive_service is None:
        credentials, _ = default(scopes=_DRIVE_SCOPES)
        _drive_service = build("drive", "v3", credentials=credentials)
    return _drive_service


def convert_pptx_to_pdf(pptx_bytes: bytes) -> bytes:
    """
    Converts a PPTX file to PDF via Google Drive API.
    Uploads the PPTX as a Google Slides file (Drive auto-converts it),
    exports it as PDF, then deletes the temp Drive file.
    Requires the Drive API to be enabled in the GCP project.
    """
    service = _get_drive_service()

    # Upload PPTX — specifying Google Slides mimeType triggers auto-conversion
    media = MediaIoBaseUpload(
        io.BytesIO(pptx_bytes),
        mimetype="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        resumable=False,
    )
    uploaded = service.files().create(
        body={
            "name": "pptx_conversion_temp",
            "mimeType": "application/vnd.google-apps.presentation",
        },
        media_body=media,
        fields="id",
    ).execute()
    file_id = uploaded["id"]

    try:
        # Export the converted Google Slides file as PDF
        request = service.files().export_media(fileId=file_id, mimeType="application/pdf")
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return buf.getvalue()
    finally:
        # Always clean up the temp Drive file regardless of success or failure
        try:
            service.files().delete(fileId=file_id).execute()
        except Exception as e:
            print(f"[PPTX] Warning: failed to delete temp Drive file {file_id}: {e}")
