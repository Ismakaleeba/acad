import re

def fix_markdown_tables(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    fixed_lines = []
    in_table = False
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        is_table_row = stripped.startswith('|') and stripped.endswith('|')
        
        if is_table_row:
            if not in_table:
                # Starting a new table, ensure there's a newline before if it's not the first line
                if fixed_lines and fixed_lines[-1].strip() != '':
                    fixed_lines.append('\n')
                in_table = True
            fixed_lines.append(line)
        elif stripped == '' and in_table:
            # Check if the next non-empty line is a table row
            next_row_index = -1
            for j in range(i + 1, len(lines)):
                if lines[j].strip() != '':
                    if lines[j].strip().startswith('|'):
                        next_row_index = j
                    break
            
            if next_row_index != -1:
                # It's an empty line between rows, skip it
                continue
            else:
                # End of table
                in_table = False
                fixed_lines.append(line)
        else:
            if in_table:
                in_table = False
            fixed_lines.append(line)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(fixed_lines)

if __name__ == "__main__":
    fix_markdown_tables('manual_content.md')
    print("Markdown tables fixed in manual_content.md")
