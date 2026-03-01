import re
import json
import os

def parse_markdown(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by PART
    parts = re.split(r'^PART ([IVXLCDM]+) – (.*)$', content, flags=re.MULTILINE)
    
    # parts[0] is the intro before PART I
    data = {
        "title": "Learn ACAD",
        "introduction": parts[0].strip(),
        "parts": []
    }

    # parts is [intro, num, title, content, num, title, content, ...]
    for i in range(1, len(parts), 3):
        part_num = parts[i]
        part_title = parts[i+1]
        part_content = parts[i+2].strip()

        # Split part_content into chapters (# headings)
        chapters = re.split(r'^# (\d+\..*)$', part_content, flags=re.MULTILINE)
        
        part_data = {
            "id": f"part-{part_num}",
            "number": part_num,
            "title": part_title.strip(),
            "chapters": []
        }

        # chapters is [intro_of_part, title, content, title, content, ...]
        if chapters[0].strip():
            part_data["intro"] = chapters[0].strip()

        for j in range(1, len(chapters), 2):
            chap_title = chapters[j]
            chap_content = chapters[j+1].strip()
            
            # Sub-split into sections (### headings) if they exist
            # For simplicity, we'll keep it at chapter level for now but preserve the markdown
            part_data["chapters"].append({
                "id": chap_title.lower().replace(" ", "-").replace(".", "").replace(",", ""),
                "title": chap_title,
                "content": chap_content
            })
        
        data["parts"].append(part_data)

    return data

if __name__ == "__main__":
    # Path relative to the root of the learn-acad directory
    md_path = "../manual_content.md"
    output_path = "public/content.json"
    
    if os.path.exists(md_path):
        parsed_data = parse_markdown(md_path)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(parsed_data, f, indent=2, ensure_ascii=False)
        print(f"Successfully parsed into {output_path}")
    else:
        print(f"Could not find markdown file at {md_path}")
