import logging
from pptx import Presentation
from io import BytesIO

logger = logging.getLogger(__name__)

def generate_ppt_from_proposal(proposal: dict, items: list) -> bytes:
    try:
        prs = Presentation()
        proposal_name = proposal.get("name", "Voyanta Proposal")
        client_name = proposal.get("client_name", "")

        # Title Slide
        title_slide_layout = prs.slide_layouts[0]
        slide = prs.slides.add_slide(title_slide_layout)
        title = slide.shapes.title
        subtitle = slide.placeholders[1]

        title.text = proposal_name
        subtitle.text = f"Prepared for: {client_name}" if client_name else "Exclusive Travel Proposal"

        # Overview Slide
        bullet_slide_layout = prs.slide_layouts[1]
        slide2 = prs.slides.add_slide(bullet_slide_layout)
        shapes = slide2.shapes
        title_shape = shapes.title
        body_shape = shapes.placeholders[1]

        title_shape.text = "Trip Overview"
        tf = body_shape.text_frame
        dest = proposal.get("destination", "Various Destinations")
        tf.text = f"Destination: {dest}"

        prefs = proposal.get("preferences", {})
        tour_type = prefs.get("tour_type", "Custom Tour")
        p = tf.add_paragraph()
        p.text = f"Tour Type: {tour_type}"

        # Items Slides (by kind)
        grouped = {}
        for it in items:
            kind = it.get("kind", "other")
            grouped.setdefault(kind, []).append(it)

        for kind, list_items in grouped.items():
            slide = prs.slides.add_slide(bullet_slide_layout)
            slide.shapes.title.text = f"{kind.capitalize()} Details"
            tf = slide.shapes.placeholders[1].text_frame
            for idx, it in enumerate(list_items):
                label = it.get("label", "Item")
                if idx == 0:
                    tf.text = label
                else:
                    p = tf.add_paragraph()
                    p.text = label
                
                # add up to 5 items per slide to avoid overflow
                if idx >= 4:
                    p = tf.add_paragraph()
                    p.text = "...and more"
                    break

        # Save to buffer
        ppt_stream = BytesIO()
        prs.save(ppt_stream)
        ppt_stream.seek(0)
        
        return ppt_stream.getvalue()
        
    except Exception as e:
        logger.exception("PPT generation failed")
        raise e
