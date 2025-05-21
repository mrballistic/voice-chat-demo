import openai
import os

openai.api_key = os.environ["OPENAI_API_KEY"]
models = openai.models.list()
for m in models.data:
    print(m.id)