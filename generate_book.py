import markdown
import os
import re

def generate_book(markdown_file, css_file, output_file):
    with open(markdown_file, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Pre-processing: Detect PART pages
    # Pattern: "PART [IVXLCDM] – [Title]" at start of line
    def make_part_page(match):
        part_num = match.group(1)
        part_title = match.group(2)
        return f'\n<div class="part-page"><div class="part-number">Part {part_num}</div><h1>{part_title}</h1></div>\n'

    md_content = re.sub(r'^PART ([IVXLCDM]+) – (.*)$', make_part_page, md_content, flags=re.MULTILINE)

    # Convert Markdown to HTML with elite extensions
    md = markdown.Markdown(extensions=['tables', 'fenced_code', 'toc', 'attr_list', 'smarty'])
    html_content = md.convert(md_content)
    toc_html = md.toc

    # Wrap tables in .action-board div for infographic styling
    html_content = html_content.replace('<table>', '<div class="action-board"><table>')
    html_content = html_content.replace('</table>', '</table></div>')

    # Apply Drop Cap and Intro Line to the first paragraph of each H1 section
    # H1 = Chapter title
    html_content = re.sub(r'(<h1 id="[^"]+">.*?</h1>\s*)<p>', r'\1<p class="drop-cap intro-line">', html_content)
    
    # Also apply Intro Line to H2 sections for consistency
    html_content = re.sub(r'(<h2 id="[^"]+">.*?</h2>\s*)<p>', r'\1<p class="intro-line">', html_content)

    # Inject ornamental dividers before H2s (except first child of a block)
    html_content = re.sub(r'(<h2 [^>]*>)', r'<div class="ornamental-divider"></div>\n\1', html_content)
    # Remove divider if it's right after a Part Page or H1
    html_content = html_content.replace('</div>\n<div class="ornamental-divider"></div>', '</div>')
    html_content = re.sub(r'(</h1>\s*)<div class="ornamental-divider"></div>', r'\1', html_content)

    title = "ACAD Debating Manual"
    tagline = "The Architecture of Critical Action Design"
    subtitle = "Official Manual – narrated, deep edition"
    author = "ISMAEL KALEEBA"
    footer_text = f"ACAD DEBATE MANUAL — {author}"
    year = "2026"

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="stylesheet" href="{css_file}">
</head>
<body>
    <div class="book-wrapper">
        <div class="title-page">
            <div style="font-size: 0.8em; letter-spacing: 0.5em; margin-bottom: 2em; color: #999;">A LITERARY DOCUMENT</div>
            <h1>{title}</h1>
            <div class="subtitle">{tagline}</div>
            <div style="margin-top: 4em; font-family: 'Fraunces'; font-weight: 300;">{subtitle}</div>
            <div style="margin-top: 6em; font-weight: 600; font-size: 1.2em;">{author}</div>
            <div style="margin-top: 1em; font-size: 0.9em; opacity: 0.7;">{year}</div>
        </div>

        <div class="title-page" style="height: 60vh; font-style: italic; opacity: 0.8;">
            <p>For those who design where others only argue.</p>
        </div>

        <div class="toc">
            <h1>Contents</h1>
            {toc_html}
        </div>

        <div class="page-footer">
            <span>{footer_text}</span>
            <span>ACAD • {year} • Page</span>
        </div>

        <div class="book-content">
            {html_content}
        </div>
    </div>
</body>
</html>"""

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(full_html)

    print(f"Successfully generated World-Class Masterpiece: {output_file}")

if __name__ == "__main__":
    generate_book('manual_content.md', 'book_styles.css', 'acad_manual_formatted.html')
