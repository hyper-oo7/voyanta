import pytest
from unittest.mock import MagicMock, patch
from src.services.pdf_vault_service import extract_images_and_link_spatially

def test_extract_images_and_link_spatially_coordinate_matching():
    mock_doc = MagicMock()
    mock_page = MagicMock()
    mock_doc.__len__.return_value = 1
    mock_doc.__getitem__.return_value = mock_page
    
    # Mock get_images to return one image
    mock_page.get_images.return_value = [(123, 0, 0, 0, 0, "DCT", "DeviceRGB", "", "", "")]
    
    # Mock extract_image to return dummy bytes
    mock_doc.extract_image.return_value = {
        "image": b"fake image bytes",
        "ext": "jpeg"
    }
    
    # Mock page.get_image_rects to place the image at y-coords [200, 300]
    # bbox = (x0, y0, x1, y1) -> (50, 200, 150, 300)
    mock_page.get_image_rects.return_value = [MagicMock()]
    mock_page.get_image_rects.return_value[0].__iter__.return_value = [50.0, 200.0, 150.0, 300.0]
    
    # Mock page.get_text("dict") to return two text blocks:
    # 1. "Day 1: Arrival & Hotel Stay" at y-coords [50, 70] (strictly above the image)
    # 2. "Activity details" at y-coords [400, 420] (strictly below the image)
    mock_page_dict = {
        "blocks": [
            {
                "type": 0,
                "lines": [
                    {
                        "spans": [
                            {
                                "text": "Hotel Hilton Stay",
                                "font": "Arial-BoldMT",
                                "flags": 4,
                                "size": 12.0,
                                "bbox": [40.0, 50.0, 160.0, 70.0]
                            }
                        ]
                    }
                ]
            },
            {
                "type": 0,
                "lines": [
                    {
                        "spans": [
                            {
                                "text": "Sightseeing Museum Activity",
                                "font": "ArialMT",
                                "flags": 0,
                                "size": 10.0,
                                "bbox": [40.0, 400.0, 160.0, 420.0]
                            }
                        ]
                    }
                ]
            }
        ]
    }
    mock_page.get_text.return_value = mock_page_dict
    
    # Mock R2 upload so we don't make network calls
    mock_upload_res = {"url": "https://pub-r2.dev/supplier-images/extracted_img.jpeg"}
    
    with patch("fitz.open", return_value=mock_doc), \
         patch("src.services.r2_storage_service.upload_file_to_r2", return_value=mock_upload_res) as mock_upload:
        
        images = extract_images_and_link_spatially("fake_path.pdf", agency_id="agency-1")
        
        # Verify image was matched to "Hotel Hilton Stay" because it's strictly above and closer
        assert len(images) == 1
        img = images[0]
        assert img["linked_entity_type"] == "hotel"
        assert img["heading_text"] == "Hotel Hilton Stay"
        assert img["url"] == "https://pub-r2.dev/supplier-images/extracted_img.jpeg"
        
        mock_upload.assert_called_once()
