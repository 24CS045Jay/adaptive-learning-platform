from app.vectorstore.chroma import get_chroma_store
import json

store = get_chroma_store()
col = store.get_or_create_collection()
data = col.get()
ids = data.get('ids', [])
metadatas = data.get('metadatas', [])
documents = data.get('documents', [])

print(f"Total vectors in Chroma: {len(ids)}")
for i, cid in enumerate(ids):
    meta = metadatas[i] if i < len(metadatas) else {}
    doc_snippet = documents[i][:80].replace('\n', ' ') if i < len(documents) else ""
    print(f"[{i}] {cid} | doc_id={meta.get('document_id')} | file={meta.get('file_name')} | subj_id={meta.get('subject_id')} | sub={meta.get('subject')} | univ={meta.get('university_id')} | dept={meta.get('department_id')}")
    print(f"    Snippet: {doc_snippet}")
