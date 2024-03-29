from bleach import clean

ALLOWED_TAGS = """
p blockquote ul ol li br h4 h5
b strong em i u strike sup sub
img video source a
table td tr th tbody thead caption
""".split()

ALLOWED_ATTRIBUTES = {
    '*': ['class'],
    'img': ['src', 'width', 'height', 'alt'],
    'a': ['rel', 'href'],
    'video': ['width', 'height', 'controls'],
    'source': ['src', 'type'],
    'table': ['cellpadding', 'cellspacing', 'class'],
    'td': ['colspan', 'rowspan', 'width', 'class'],
    'th': ['colspan', 'rowspan', 'width', 'class'],
    'tr': ['colspan', 'rowspan', 'width', 'class'],
    'blockquote': ['class']
}


def clean_html(src):
    return clean(src, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, strip=True)
