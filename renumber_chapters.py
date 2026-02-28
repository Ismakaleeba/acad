import re

def renumber_chapters(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    chapter_counter = 1
    
    def replacer(match):
        nonlocal chapter_counter
        # match.group(0) is the full match, match.group(1) is the captured title text
        new_heading = f"# {chapter_counter}. {match.group(1).strip()}"
        chapter_counter += 1
        return new_heading

    # Regex: Match line start ^, then '# ', digits, '.', optional space, then capture the rest (.*?) until end of line $
    new_content = re.sub(r'^# \d+\.\s*(.*?)$', replacer, content, flags=re.MULTILINE)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print(f"Renumbered {chapter_counter - 1} chapters.")

if __name__ == "__main__":
    renumber_chapters('c:/Users/kalee/OneDrive/Desktop/Book/manual_content.md')
