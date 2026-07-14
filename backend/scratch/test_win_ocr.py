import os
import subprocess
import tempfile
import fitz

def win_ocr_pdf(pdf_path: str):
    doc = fitz.open(pdf_path)
    ocr_texts = []
    
    with tempfile.TemporaryDirectory() as tmpdir:
        for i, page in enumerate(doc):
            pix = page.get_pixmap()
            img_path = os.path.join(tmpdir, f"page_{i}.png")
            pix.save(img_path)
            
            # PowerShell command for native OCR (loads Drawing and Media.Ocr namespaces)
            ps_cmd = f"""
            Add-Type -AssemblyName System.Windows.Forms
            Add-Type -AssemblyName System.Drawing
            [void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
            $bitmap = [System.Drawing.Bitmap]::FromFile('{img_path}')
            $memoryStream = New-Object System.IO.MemoryStream
            $bitmap.Save($memoryStream, [System.Drawing.Imaging.ImageFormat]::Png)
            $memoryStream.Position = 0
            $randomAccessStream = [Windows.Storage.Streams.RandomAccessStream]::CreateFromStream($memoryStream)
            $ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
            if ($ocrEngine) {{
                $softwareBitmap = [Windows.Graphics.Imaging.SoftwareBitmap]::CreateCopyFromBuffer(
                    $randomAccessStream.GetInputStreamAt(0), 
                    [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, 
                    $bitmap.Width, 
                    $bitmap.Height
                )
                $ocrResult = $ocrEngine.RecognizeAsync($softwareBitmap).GetResults()
                Write-Output $ocrResult.Text
            }}
            $bitmap.Dispose()
            """
            
            res = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_cmd],
                capture_output=True,
                text=True
            )
            if res.returncode == 0:
                text = res.stdout.strip()
                if text:
                    ocr_texts.append(text)
            else:
                print(f"Error on page {i}: {res.stderr}")
                
    return "\n\n".join(ocr_texts)

pdf_file = r"c:\Users\RAMAN\Projects\Voyanta\voyanta\backend\public_r2_mock\supplier-pdfs\test-agency\1783698950059-9285df97828a4deaacc9f2323cbb6611.pdf"
res = win_ocr_pdf(pdf_file)
print("Extracted text length:", len(res))
print("Preview:")
print(res[:300])
