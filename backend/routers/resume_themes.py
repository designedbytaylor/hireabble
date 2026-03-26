"""Resume PDF generation with multiple themes.

Themes:
  - classic: Clean single-column layout (default, similar to original)
  - modern: Two-column layout with dark sidebar containing photo, contact, skills
  - minimal: Elegant single-column with thin lines and refined typography
"""
import io
import os
import urllib.request
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Image,
    Table, TableStyle, Flowable
)
from reportlab.lib.utils import ImageReader
from xml.sax.saxutils import escape as xml_escape


class RoundedImage(Flowable):
    """Image with rounded corners using a clipping path."""
    def __init__(self, image_data, width, height, radius=6, hAlign='CENTER'):
        Flowable.__init__(self)
        self.image_data = image_data
        self.img_width = width
        self.img_height = height
        self.radius = radius
        self.width = width
        self.height = height
        self.hAlign = hAlign

    def draw(self):
        c = self.canv
        w, h, r = self.img_width, self.img_height, self.radius
        c.saveState()
        # Draw rounded rectangle clipping path
        p = c.beginPath()
        p.roundRect(0, 0, w, h, r)
        c.clipPath(p, stroke=0)
        c.drawImage(ImageReader(self.image_data), 0, 0, w, h)
        c.restoreState()


def esc(val):
    """Escape XML special characters for ReportLab Paragraph."""
    if not val or not isinstance(val, str):
        return val or ""
    return xml_escape(val)


def _get_job_title(job):
    """Get job title from work_history entry, handling both 'title' and 'position' fields."""
    return job.get('title') or job.get('position') or 'Role'


def _fetch_photo(photo_url):
    """Download profile photo and return as BytesIO, or None on failure."""
    if not photo_url:
        return None
    import logging
    logger = logging.getLogger(__name__)
    try:
        # Some CDN/external URLs need standard browser-like headers
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; Hireabble/1.0)',
            'Accept': 'image/*,*/*',
        }
        req = urllib.request.Request(photo_url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            ct = resp.headers.get('Content-Type', '')
            if ct.startswith('image') or ct.startswith('application/octet-stream'):
                data = resp.read()
                if len(data) > 100:  # Sanity check — not an error page
                    buf = io.BytesIO(data)
                    buf.seek(0)
                    return buf
            logger.warning(f"Photo fetch got unexpected content-type: {ct} for {photo_url[:80]}")
    except Exception as e:
        logger.warning(f"Photo fetch failed for {photo_url[:80]}: {e}")
    # Fallback: try the avatar URL if it looks like a dicebear/generated avatar
    return None


def _degree_display(degree_key):
    """Map degree keys to display labels."""
    degree_map = {
        'high_school': 'High School Diploma', 'some_college': 'Some College',
        'associates': "Associate's Degree", 'bachelors': "Bachelor's Degree",
        'masters': "Master's Degree", 'phd': 'PhD / Doctorate',
        'bootcamp': 'Bootcamp / Certification', 'self_taught': 'Self-taught',
    }
    return degree_map.get(degree_key, degree_key) if degree_key else ''


# ===========================
# THEME: CLASSIC
# ===========================
def generate_classic(user, include_photo=True, for_recruiter=False):
    """Clean single-column layout — enhanced version of the original."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.5*inch, bottomMargin=0.5*inch,
        leftMargin=0.65*inch, rightMargin=0.65*inch
    )
    styles = getSampleStyleSheet()

    primary = colors.HexColor('#1a1a2e')
    accent = colors.HexColor('#6366f1')
    dark_gray = colors.HexColor('#333333')
    med_gray = colors.HexColor('#666666')
    light_gray = colors.HexColor('#999999')

    name_style = ParagraphStyle('Name', parent=styles['Heading1'],
        fontSize=26, textColor=primary, spaceAfter=6, fontName='Helvetica-Bold', alignment=TA_LEFT, leading=30)
    title_style = ParagraphStyle('Title', parent=styles['Normal'],
        fontSize=14, textColor=accent, spaceAfter=4, fontName='Helvetica')
    contact_style = ParagraphStyle('Contact', parent=styles['Normal'],
        fontSize=9, textColor=med_gray, spaceAfter=2, fontName='Helvetica')
    section_style = ParagraphStyle('Section', parent=styles['Heading2'],
        fontSize=12, textColor=accent, spaceBefore=14, spaceAfter=6,
        fontName='Helvetica-Bold', borderWidth=0, leading=16)
    job_title_style = ParagraphStyle('JobTitle', parent=styles['Normal'],
        fontSize=11, textColor=primary, fontName='Helvetica-Bold', spaceAfter=1)
    company_style = ParagraphStyle('Company', parent=styles['Normal'],
        fontSize=10, textColor=med_gray, fontName='Helvetica', spaceAfter=2)
    body_style = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=10, textColor=dark_gray, spaceAfter=4, fontName='Helvetica', leading=14)
    bullet_style = ParagraphStyle('Bullet', parent=styles['Normal'],
        fontSize=10, textColor=dark_gray, leftIndent=12, fontName='Helvetica', leading=13, spaceAfter=2)

    elements = []

    # Header with optional photo
    photo_buf = _fetch_photo(user.get('photo_url')) if include_photo else None
    if photo_buf:
        # Photo + name side by side
        photo_img = RoundedImage(photo_buf, width=60, height=60, radius=8, hAlign='LEFT')
        name_parts = []
        name_parts.append(Paragraph(esc(user.get('name', 'Job Seeker')), name_style))
        if user.get('title'):
            name_parts.append(Paragraph(esc(user['title']), title_style))
        from reportlab.platypus import KeepTogether
        name_table = Table(
            [[photo_img, name_parts]],
            colWidths=[70, None],
        )
        name_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (0, 0), 0),
            ('RIGHTPADDING', (0, 0), (0, 0), 8),
            ('LEFTPADDING', (1, 0), (1, 0), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(name_table)
    else:
        elements.append(Paragraph(esc(user.get('name', 'Job Seeker')), name_style))
        if user.get('title'):
            elements.append(Paragraph(esc(user['title']), title_style))

    # Contact line
    contact_parts = _build_contact_parts(user, for_recruiter)
    if contact_parts:
        elements.append(Paragraph("  |  ".join(contact_parts), contact_style))

    elements.append(Spacer(1, 4))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e0e0e0'), spaceAfter=8))

    # Professional Summary
    if user.get('bio'):
        elements.append(Paragraph("PROFESSIONAL SUMMARY", section_style))
        elements.append(Paragraph(esc(user['bio']), body_style))

    # Experience
    _add_experience(elements, user, section_style, job_title_style, company_style, bullet_style)

    # Education
    _add_education(elements, user, section_style, job_title_style, company_style)

    # Skills
    if user.get('skills'):
        elements.append(Paragraph("SKILLS", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        elements.append(Paragraph("  •  ".join(esc(s) for s in user['skills']), body_style))

    # Certifications
    if user.get('certifications'):
        elements.append(Paragraph("CERTIFICATIONS", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        for cert in user['certifications']:
            if isinstance(cert, str) and cert.strip():
                elements.append(Paragraph(f"• {esc(cert)}", bullet_style))

    # Interests
    if user.get('interests'):
        elements.append(Paragraph("INTERESTS", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        elements.append(Paragraph("  •  ".join(esc(s) for s in user['interests']), body_style))

    # References (seeker self-download only)
    if not for_recruiter:
        _add_references(elements, user, section_style, body_style, styles, light_gray)

    elements.append(Spacer(1, 20))
    doc.build(elements)
    buffer.seek(0)
    return buffer


# ===========================
# THEME: MODERN (sidebar)
# ===========================
def generate_modern(user, include_photo=True, for_recruiter=False):
    """Two-column layout with dark sidebar."""
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate
    from reportlab.lib.units import inch, cm

    buffer = io.BytesIO()
    W, H = letter  # 612 x 792

    sidebar_w = 180
    main_w = W - sidebar_w
    sidebar_color = colors.HexColor('#2d3748')
    accent = colors.HexColor('#38b2ac')
    white = colors.white
    dark = colors.HexColor('#1a202c')
    med_gray = colors.HexColor('#666666')
    dark_gray = colors.HexColor('#333333')

    styles = getSampleStyleSheet()

    # Sidebar styles (white on dark)
    sb_heading = ParagraphStyle('SBHead', parent=styles['Normal'],
        fontSize=10, textColor=accent, fontName='Helvetica-Bold', spaceBefore=12, spaceAfter=4, leading=12)
    sb_text = ParagraphStyle('SBText', parent=styles['Normal'],
        fontSize=9, textColor=white, fontName='Helvetica', spaceAfter=2, leading=11)
    sb_small = ParagraphStyle('SBSmall', parent=styles['Normal'],
        fontSize=8, textColor=colors.HexColor('#a0aec0'), fontName='Helvetica', spaceAfter=1, leading=10)

    # Main content styles
    name_style = ParagraphStyle('Name', parent=styles['Heading1'],
        fontSize=24, textColor=dark, spaceAfter=2, fontName='Helvetica-Bold')
    title_style = ParagraphStyle('Title', parent=styles['Normal'],
        fontSize=13, textColor=accent, spaceAfter=6, fontName='Helvetica')
    section_style = ParagraphStyle('Section', parent=styles['Heading2'],
        fontSize=11, textColor=dark, spaceBefore=12, spaceAfter=4,
        fontName='Helvetica-Bold', leading=14)
    body_style = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=9.5, textColor=dark_gray, spaceAfter=3, fontName='Helvetica', leading=13)
    job_title_style = ParagraphStyle('JobTitle', parent=styles['Normal'],
        fontSize=10, textColor=dark, fontName='Helvetica-Bold', spaceAfter=1)
    company_style = ParagraphStyle('Company', parent=styles['Normal'],
        fontSize=9, textColor=med_gray, fontName='Helvetica', spaceAfter=2)
    bullet_style = ParagraphStyle('Bullet', parent=styles['Normal'],
        fontSize=9.5, textColor=dark_gray, leftIndent=8, fontName='Helvetica', leading=12, spaceAfter=1)

    # Build sidebar elements
    sidebar_elements = []

    # Photo
    photo_buf = _fetch_photo(user.get('photo_url')) if include_photo else None
    if photo_buf:
        photo_img = RoundedImage(photo_buf, width=100, height=100, radius=12, hAlign='CENTER')
        sidebar_elements.append(Spacer(1, 8))
        sidebar_elements.append(photo_img)
        sidebar_elements.append(Spacer(1, 8))

    # Contact
    sidebar_elements.append(Paragraph("CONTACT", sb_heading))
    contact_parts = _build_contact_parts(user, for_recruiter)
    for part in contact_parts:
        sidebar_elements.append(Paragraph(esc(part), sb_text))

    # Skills
    if user.get('skills'):
        sidebar_elements.append(Paragraph("SKILLS", sb_heading))
        for skill in user['skills']:
            sidebar_elements.append(Paragraph(f"• {esc(skill)}", sb_text))

    # Education (compact in sidebar)
    edu_list = user.get('education', [])
    if edu_list or user.get('school'):
        sidebar_elements.append(Paragraph("EDUCATION", sb_heading))
        if edu_list:
            for edu in edu_list:
                dt = esc(edu.get('degree', ''))
                if edu.get('field'):
                    dt += f" in {esc(edu['field'])}" if dt else esc(edu['field'])
                if dt:
                    sidebar_elements.append(Paragraph(dt, sb_text))
                if edu.get('school'):
                    sidebar_elements.append(Paragraph(esc(edu['school']), sb_small))
                if edu.get('year'):
                    sidebar_elements.append(Paragraph(esc(str(edu['year'])), sb_small))
                sidebar_elements.append(Spacer(1, 4))
        elif user.get('school'):
            if user.get('degree'):
                sidebar_elements.append(Paragraph(esc(_degree_display(user['degree'])), sb_text))
            sidebar_elements.append(Paragraph(esc(user['school']), sb_small))

    # Interests
    if user.get('interests'):
        sidebar_elements.append(Paragraph("INTERESTS", sb_heading))
        for interest in user['interests']:
            sidebar_elements.append(Paragraph(f"• {esc(interest)}", sb_text))

    # Certifications
    if user.get('certifications'):
        sidebar_elements.append(Paragraph("CERTIFICATIONS", sb_heading))
        for cert in user['certifications']:
            if isinstance(cert, str) and cert.strip():
                sidebar_elements.append(Paragraph(f"• {esc(cert)}", sb_text))

    # Build main content elements
    main_elements = []
    main_elements.append(Paragraph(esc(user.get('name', 'Job Seeker')), name_style))
    if user.get('title'):
        main_elements.append(Paragraph(esc(user['title']), title_style))

    # Bio
    if user.get('bio'):
        main_elements.append(Paragraph("PROFILE", section_style))
        main_elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=4))
        main_elements.append(Paragraph(esc(user['bio']), body_style))

    # Experience
    work_history = user.get('work_history', [])
    if work_history or user.get('current_employer'):
        main_elements.append(Paragraph("EXPERIENCE", section_style))
        main_elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=4))
        if work_history:
            for job in work_history:
                main_elements.append(Paragraph(esc(_get_job_title(job)), job_title_style))
                cl = esc(job.get('company', ''))
                dates = ""
                if job.get('start_date'):
                    dates = esc(job['start_date'])
                    dates += f" – {esc(job.get('end_date', 'Present'))}"
                if cl and dates:
                    cl += f"  |  {dates}"
                main_elements.append(Paragraph(cl, company_style))
                if job.get('description'):
                    for line in job['description'].split('\n'):
                        line = line.strip()
                        if line:
                            main_elements.append(Paragraph(f"• {esc(line)}", bullet_style))
                main_elements.append(Spacer(1, 4))
        elif user.get('current_employer'):
            main_elements.append(Paragraph(esc(user.get('title', 'Professional')), job_title_style))
            exp_str = f"{user.get('experience_years', 0)}+ years" if user.get('experience_years') else ""
            main_elements.append(Paragraph(f"{esc(user['current_employer'])}  |  {exp_str}", company_style))

    # References (seeker only)
    if not for_recruiter:
        refs = user.get('references', [])
        if refs and not user.get('references_hidden', True):
            main_elements.append(Paragraph("REFERENCES", section_style))
            main_elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=4))
            for ref in refs:
                line = f"<b>{esc(ref.get('name', ''))}</b>"
                if ref.get('title'):
                    line += f" – {esc(ref['title'])}"
                if ref.get('company'):
                    line += f" at {esc(ref['company'])}"
                contact = ref.get('email') or ref.get('phone', '')
                if contact:
                    line += f"  |  {esc(contact)}"
                main_elements.append(Paragraph(line, body_style))

    # Use canvas-based approach for the two-column layout
    from reportlab.platypus import Frame, BaseDocTemplate, PageTemplate

    margin = 0.4 * inch
    sidebar_frame = Frame(0, 0, sidebar_w, H, leftPadding=14, rightPadding=10,
                          topPadding=20, bottomPadding=20, id='sidebar')
    main_frame = Frame(sidebar_w, 0, main_w, H, leftPadding=20, rightPadding=margin,
                       topPadding=margin, bottomPadding=margin, id='main')

    def draw_sidebar_bg(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(sidebar_color)
        canvas.rect(0, 0, sidebar_w, H, fill=1, stroke=0)
        canvas.restoreState()

    # Build with two frames — sidebar first, then main
    doc = BaseDocTemplate(buffer, pagesize=letter)
    # We need to flow sidebar and main into their respective frames
    # Since BaseDocTemplate flows content into frames sequentially,
    # we use a FrameBreak to switch from sidebar to main

    from reportlab.platypus import FrameBreak
    page_template = PageTemplate(
        id='modern',
        frames=[sidebar_frame, main_frame],
        onPage=draw_sidebar_bg
    )
    doc.addPageTemplates([page_template])

    all_elements = sidebar_elements + [FrameBreak()] + main_elements
    doc.build(all_elements)
    buffer.seek(0)
    return buffer


# ===========================
# THEME: MINIMAL
# ===========================
def generate_minimal(user, include_photo=True, for_recruiter=False):
    """Elegant single-column with refined typography and subtle styling."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.6*inch, bottomMargin=0.5*inch,
        leftMargin=0.75*inch, rightMargin=0.75*inch
    )
    styles = getSampleStyleSheet()

    dark = colors.HexColor('#111827')
    mid = colors.HexColor('#4b5563')
    light = colors.HexColor('#9ca3af')
    accent_line = colors.HexColor('#d1d5db')

    name_style = ParagraphStyle('Name', parent=styles['Heading1'],
        fontSize=22, textColor=dark, spaceAfter=2, fontName='Helvetica-Bold',
        alignment=TA_CENTER, leading=26)
    title_style = ParagraphStyle('Title', parent=styles['Normal'],
        fontSize=11, textColor=mid, spaceAfter=4, fontName='Helvetica',
        alignment=TA_CENTER)
    contact_style = ParagraphStyle('Contact', parent=styles['Normal'],
        fontSize=8.5, textColor=light, spaceAfter=6, fontName='Helvetica',
        alignment=TA_CENTER)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'],
        fontSize=10, textColor=dark, spaceBefore=14, spaceAfter=4,
        fontName='Helvetica-Bold', leading=13, tracking=2)
    body_style = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=9.5, textColor=mid, spaceAfter=4, fontName='Helvetica', leading=13)
    job_title_style = ParagraphStyle('JobTitle', parent=styles['Normal'],
        fontSize=10, textColor=dark, fontName='Helvetica-Bold', spaceAfter=0.5)
    company_style = ParagraphStyle('Company', parent=styles['Normal'],
        fontSize=9, textColor=light, fontName='Helvetica', spaceAfter=2)
    bullet_style = ParagraphStyle('Bullet', parent=styles['Normal'],
        fontSize=9.5, textColor=mid, leftIndent=10, fontName='Helvetica', leading=12, spaceAfter=1)

    elements = []

    # Optional centered photo
    photo_buf = _fetch_photo(user.get('photo_url')) if include_photo else None
    if photo_buf:
        photo_img = RoundedImage(photo_buf, width=55, height=55, radius=8, hAlign='CENTER')
        elements.append(photo_img)
        elements.append(Spacer(1, 6))

    # Name and title centered
    elements.append(Paragraph(esc(user.get('name', 'Job Seeker')).upper(), name_style))
    if user.get('title'):
        elements.append(Paragraph(esc(user['title']), title_style))

    contact_parts = _build_contact_parts(user, for_recruiter)
    if contact_parts:
        elements.append(Paragraph("  |  ".join(contact_parts), contact_style))

    elements.append(HRFlowable(width="100%", thickness=0.5, color=accent_line, spaceAfter=6, spaceBefore=4))

    # Bio
    if user.get('bio'):
        elements.append(Paragraph("P R O F I L E", section_style))
        elements.append(Paragraph(esc(user['bio']), body_style))

    # Experience
    work_history = user.get('work_history', [])
    if work_history or user.get('current_employer'):
        elements.append(Paragraph("E X P E R I E N C E", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.3, color=accent_line, spaceAfter=4))
        if work_history:
            for job in work_history:
                # Title and dates on same line using table
                title_text = esc(_get_job_title(job))
                dates = ""
                if job.get('start_date'):
                    dates = f"{esc(job['start_date'])} – {esc(job.get('end_date', 'Present'))}"
                if dates:
                    date_style = ParagraphStyle('Dates', parent=styles['Normal'],
                        fontSize=9, textColor=light, fontName='Helvetica', alignment=2)  # RIGHT
                    row = Table(
                        [[Paragraph(title_text, job_title_style), Paragraph(dates, date_style)]],
                        colWidths=[None, 120]
                    )
                    row.setStyle(TableStyle([
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('LEFTPADDING', (0, 0), (-1, -1), 0),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                        ('TOPPADDING', (0, 0), (-1, -1), 0),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                    ]))
                    elements.append(row)
                else:
                    elements.append(Paragraph(title_text, job_title_style))
                if job.get('company'):
                    elements.append(Paragraph(esc(job['company']), company_style))
                if job.get('description'):
                    for line in job['description'].split('\n'):
                        line = line.strip()
                        if line:
                            elements.append(Paragraph(f"• {esc(line)}", bullet_style))
                elements.append(Spacer(1, 5))
        elif user.get('current_employer'):
            elements.append(Paragraph(esc(user.get('title', 'Professional')), job_title_style))
            exp_str = f"{user.get('experience_years', 0)}+ years" if user.get('experience_years') else ""
            elements.append(Paragraph(f"{esc(user['current_employer'])}  |  {exp_str}", company_style))

    # Education
    edu_list = user.get('education', [])
    if edu_list or user.get('school'):
        elements.append(Paragraph("E D U C A T I O N", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.3, color=accent_line, spaceAfter=4))
        if edu_list:
            for edu in edu_list:
                dt = esc(edu.get('degree', ''))
                if edu.get('field'):
                    dt += f" in {esc(edu['field'])}" if dt else esc(edu['field'])
                if dt:
                    elements.append(Paragraph(dt, job_title_style))
                sl = esc(edu.get('school', ''))
                if edu.get('year'):
                    sl += f"  |  {esc(str(edu['year']))}"
                if sl:
                    elements.append(Paragraph(sl, company_style))
                elements.append(Spacer(1, 3))
        elif user.get('school'):
            if user.get('degree'):
                elements.append(Paragraph(esc(_degree_display(user['degree'])), job_title_style))
            elements.append(Paragraph(esc(user['school']), company_style))

    # Skills
    if user.get('skills'):
        elements.append(Paragraph("S K I L L S", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.3, color=accent_line, spaceAfter=4))
        elements.append(Paragraph("  •  ".join(esc(s) for s in user['skills']), body_style))

    # Certifications
    if user.get('certifications'):
        elements.append(Paragraph("C E R T I F I C A T I O N S", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.3, color=accent_line, spaceAfter=4))
        for cert in user['certifications']:
            if isinstance(cert, str) and cert.strip():
                elements.append(Paragraph(f"• {esc(cert)}", bullet_style))

    # Interests
    if user.get('interests'):
        elements.append(Paragraph("I N T E R E S T S", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.3, color=accent_line, spaceAfter=4))
        elements.append(Paragraph("  •  ".join(esc(s) for s in user['interests']), body_style))

    # References
    if not for_recruiter:
        _add_references(elements, user, section_style, body_style, styles, light)

    elements.append(Spacer(1, 20))
    doc.build(elements)
    buffer.seek(0)
    return buffer


# ===========================
# SHARED HELPERS
# ===========================
def _build_contact_parts(user, for_recruiter=False):
    """Build contact line parts based on privacy settings."""
    parts = []
    if for_recruiter:
        if user.get('show_contact_on_resume'):
            if user.get('email'):
                parts.append(esc(user['email']))
            if user.get('location'):
                parts.append(esc(user['location']))
        else:
            if user.get('location'):
                parts.append(esc(user['location']))
            parts.append("Contact via Hireabble")
    else:
        if user.get('email'):
            parts.append(esc(user['email']))
        if user.get('location'):
            parts.append(esc(user['location']))
        if user.get('work_preference'):
            pref_labels = {'remote': 'Remote', 'onsite': 'On-site', 'hybrid': 'Hybrid', 'flexible': 'Flexible'}
            parts.append(pref_labels.get(user['work_preference'], user['work_preference']))
    return parts


def _add_experience(elements, user, section_style, job_title_style, company_style, bullet_style):
    """Add experience section."""
    work_history = user.get('work_history', [])
    if not work_history and not user.get('current_employer'):
        return

    elements.append(Paragraph("EXPERIENCE", section_style))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))

    if work_history:
        for job in work_history:
            elements.append(Paragraph(esc(_get_job_title(job)), job_title_style))
            cl = esc(job.get('company', ''))
            dates = ""
            if job.get('start_date'):
                dates = esc(job['start_date'])
                dates += f" – {esc(job.get('end_date', 'Present'))}"
            if cl and dates:
                cl += f"  |  {dates}"
            elements.append(Paragraph(cl, company_style))
            if job.get('description'):
                for line in job['description'].split('\n'):
                    line = line.strip()
                    if line:
                        elements.append(Paragraph(f"• {esc(line)}", bullet_style))
            elements.append(Spacer(1, 6))
    elif user.get('current_employer'):
        elements.append(Paragraph(esc(user.get('title', 'Professional')), job_title_style))
        exp_str = f"{user.get('experience_years', 0)}+ years" if user.get('experience_years') else ""
        elements.append(Paragraph(f"{esc(user['current_employer'])}  |  {exp_str}", company_style))


def _add_education(elements, user, section_style, job_title_style, company_style):
    """Add education section."""
    edu_list = user.get('education', [])
    if not edu_list and not user.get('school'):
        return

    elements.append(Paragraph("EDUCATION", section_style))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))

    if edu_list:
        for edu in edu_list:
            dt = esc(edu.get('degree', ''))
            if edu.get('field'):
                dt += f" in {esc(edu['field'])}" if dt else esc(edu['field'])
            if dt:
                elements.append(Paragraph(dt, job_title_style))
            sl = esc(edu.get('school', ''))
            if edu.get('year'):
                sl += f"  |  {esc(str(edu['year']))}"
            if sl:
                elements.append(Paragraph(sl, company_style))
            elements.append(Spacer(1, 4))
    else:
        if user.get('degree'):
            elements.append(Paragraph(esc(_degree_display(user['degree'])), job_title_style))
        if user.get('school'):
            elements.append(Paragraph(esc(user['school']), company_style))


def _add_references(elements, user, section_style, body_style, styles, light_color):
    """Add references section (seeker self-download only)."""
    refs = user.get('references', [])
    if refs and not user.get('references_hidden', True):
        elements.append(Paragraph("REFERENCES", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        for ref in refs:
            line = f"<b>{esc(ref.get('name', ''))}</b>"
            if ref.get('title'):
                line += f" – {esc(ref['title'])}"
            if ref.get('company'):
                line += f" at {esc(ref['company'])}"
            contact = ref.get('email') or ref.get('phone', '')
            if contact:
                line += f"  |  {esc(contact)}"
            elements.append(Paragraph(line, body_style))
    elif refs:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("References available upon request", ParagraphStyle(
            'RefNote', parent=styles['Normal'], fontSize=9, textColor=light_color, alignment=TA_CENTER
        )))


# ===========================
# ENTRY POINT
# ===========================
THEMES = {
    'classic': generate_classic,
    'modern': generate_modern,
    'minimal': generate_minimal,
}

def generate_resume_pdf(user, theme='classic', include_photo=True, for_recruiter=False):
    """Generate a resume PDF with the specified theme.

    Args:
        user: dict with user profile data
        theme: 'classic', 'modern', or 'minimal'
        include_photo: whether to include profile photo
        for_recruiter: if True, respects privacy settings and omits references

    Returns:
        io.BytesIO with PDF content
    """
    generator = THEMES.get(theme, generate_classic)
    return generator(user, include_photo=include_photo, for_recruiter=for_recruiter)
