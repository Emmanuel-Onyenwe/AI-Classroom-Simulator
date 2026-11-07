# Wiring lesson_engine.py into app.py

Put `lesson_engine.py` next to `app.py`. Three small edits.

## 1. Import (top of app.py)
```python
import lesson_engine as le
```

## 2. PDF ingestion (section 7) — replaces the `range(15, min(19, ...))` block
```python
reader = PyPDF2.PdfReader(uploaded_file)
pages = le.extract_pages(reader)
warn = le.scan_warning(pages)
if warn:
    st.error(warn); st.stop()

sections = le.chunk_pages(pages)
gen = lambda p: safe_generate_chat(model.start_chat(history=[]), p).text
sections = le.build_lesson_plan(gen, sections, st.session_state.mode)

st.session_state.sections = sections
st.session_state.pdf_text = le.course_text(sections)   # was trim_text(text) at 6000 chars
```
The welcome message can now list the section titles, so the student can pick
where to start instead of only "Fresh Start" or "Area of Concern".

## 3. Plot rendering (two places: chat history and new reply)
Replace
```python
y = eval(plot_formula, {"__builtins__": None}, {"x": x, "np": np})
```
with
```python
y = le.safe_eval_formula(plot_formula, x)
```
and change the `except Exception` so it catches `ValueError` as well.

## Teaching a section (used by the board in the next step)
```python
sec = le.teach_section(gen, st.session_state.sections[i], st.session_state.mode)
for beat in sec.beats:
    beat["say"]    # spoken by the voice chain
    beat["board"]  # items the board writes while it speaks
```
