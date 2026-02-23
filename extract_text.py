import xml.etree.ElementTree as ET
import sys
import os

def extract_text_to_markdown(xml_file, output_file):
    try:
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        # Word XML namespaces
        namespaces = {
            'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
            'w14': 'http://schemas.microsoft.com/office/word/2010/wordml'
        }
        
        style_map = {
            'Title': '# ',
            'Heading1': '# ',
            'Heading2': '## ',
            'Heading3': '### ',
            'Heading4': '#### ',
            'Heading5': '##### ',
            'Heading6': '###### ',
            'Subtitle': '## '
        }
        
        markdown_lines = []
        
        def get_text(element):
            text = ""
            for node in element.iter():
                if node.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t':
                    text += node.text if node.text else ""
                elif node.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}br':
                    text += "\n"
            return text

        body = root.find('.//w:body', namespaces)
        for element in body:
            if element.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p':
                p = element
                # Check for style
                pStyle = p.find('.//w:pStyle', namespaces)
                prefix = ""
                if pStyle is not None:
                    style_id = pStyle.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val')
                    prefix = style_map.get(style_id, "")
                
                # Check for lists
                numPr = p.find('.//w:numPr', namespaces)
                if numPr is not None:
                    prefix = "- "
                    
                paragraph_text = get_text(p).strip()
                
                if paragraph_text:
                    import re
                    paragraph_text = re.sub(r'([a-z])([A-Z])', r'\1 \2', paragraph_text)
                    paragraph_text = paragraph_text.replace("(ACAD)Official", "(ACAD) Official")
                    markdown_lines.append(f"{prefix}{paragraph_text}")
                elif not prefix:
                    markdown_lines.append("")
            
            elif element.tag == '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tbl':
                markdown_lines.append("") # Spacer
                rows = element.findall('.//w:tr', namespaces)
                table_md = []
                for i, row in enumerate(rows):
                    cells = row.findall('.//w:tc', namespaces)
                    cell_texts = [get_text(cell).replace("\n", " ").strip() for cell in cells]
                    table_md.append("| " + " | ".join(cell_texts) + " |")
                    if i == 0:
                        table_md.append("| " + " | ".join(["---"] * len(cells)) + " |")
                markdown_lines.extend(table_md)
                markdown_lines.append("") # Spacer
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("\n\n".join(markdown_lines))
            
        return f"Successfully extracted text to {output_file}"
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python extract_text.py <xml_file> <output_file>")
        sys.exit(1)
    
    xml_path = sys.argv[1]
    output_path = sys.argv[2]
    result = extract_text_to_markdown(xml_path, output_path)
    print(result)
