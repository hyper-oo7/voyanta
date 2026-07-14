import io
from fastapi import UploadFile

temp_file = io.BytesIO(b"hello world")
upload_file = UploadFile(file=temp_file, filename="test.txt")

upload_file.file.seek(0, 2)
size = upload_file.file.tell()
upload_file.file.seek(0)
print("Size computed via raw file:", size)
