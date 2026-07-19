import fitz
from typing import List, Optional

def table_to_markdown(data: List[List[Optional[str]]]) -> str:
    if not data:
        return ""
    
    # Process cells: replace None with "", strip, and join lines with space
    processed_data = []
    for row in data:
        processed_row = []
        for cell in row:
            if cell is None:
                val = ""
            else:
                val = " ".join(cell.split())
            processed_row.append(val)
        if any(processed_row):
            processed_data.append(processed_row)
            
    if not processed_data:
        return ""
        
    num_cols = max(len(row) for row in processed_data)
    
    # Pad rows to match max number of columns
    for row in processed_data:
        while len(row) < num_cols:
            row.append("")
            
    # Find columns that are entirely empty
    non_empty_col_indices = []
    for col_idx in range(num_cols):
        col_has_content = False
        for row in processed_data:
            if row[col_idx].strip():
                col_has_content = True
                break
        if col_has_content:
            non_empty_col_indices.append(col_idx)
            
    if not non_empty_col_indices:
        return ""
        
    # Filter columns to only keep non-empty ones
    filtered_data = []
    for row in processed_data:
        filtered_row = [row[idx] for idx in non_empty_col_indices]
        filtered_data.append(filtered_row)
        
    headers = filtered_data[0]
    headers = [h if h else f"Col {idx+1}" for idx, h in enumerate(headers)]
    num_filtered_cols = len(headers)
    separator = ["---"] * num_filtered_cols
    
    lines = []
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("| " + " | ".join(separator) + " |")
    for row in filtered_data[1:]:
        lines.append("| " + " | ".join(row) + " |")
        
    return "\n".join(lines)

pdf_path = r"c:\Users\RAMAN\Projects\Voyanta\voyanta\backend\temp_supplier_pdfs\1784473080_5471b06cf1864736_Mr._Shivam_Bhardwaj.pdf"
doc = fitz.open(pdf_path)

# Test on page 17 (index 16)
page = doc[16]
tables = page.find_tables()
if tables and tables.tables:
    for table in tables.tables:
        print(table_to_markdown(table.extract()))
