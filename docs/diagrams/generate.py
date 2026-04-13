"""
PodcastGen — Architecture Diagram Generator

Run:  python docs/diagrams/generate.py
Out:  docs/diagrams/architecture-overview.png
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.client import User
from diagrams.azure.aimachinelearning import AzureOpenai, SpeechServices
from diagrams.azure.storage import BlobStorage
from diagrams.programming.framework import React

graph_attr = {
    "fontsize": "28",
    "bgcolor": "white",
    "pad": "0.8",
    "nodesep": "1.0",
    "ranksep": "2.0",
    "dpi": "150",
    "fontname": "Segoe UI Bold",
    "splines": "ortho",
    "label": "PodcastGen — Architecture\nAll Azure auth via DefaultAzureCredential (Entra ID) — no API keys or SAS tokens",
    "labelloc": "t",
    "labeljust": "c",
    "fontcolor": "#333333",
}

node_attr = {
    "fontsize": "14",
    "fontname": "Segoe UI Bold",
}

edge_attr = {
    "fontsize": "12",
    "fontname": "Segoe UI Bold",
    "color": "#000000",
    "penwidth": "1.5",
}

cluster_style = {
    "fontsize": "16",
    "fontname": "Segoe UI Bold",
    "fontcolor": "#333333",
    "style": "dashed,rounded",
    "pencolor": "#7f7f7f",
    "penwidth": "1.5",
    "bgcolor": "#f2f2f200",
}

with Diagram(
    "",
    filename="docs/diagrams/architecture-overview",
    show=False,
    direction="LR",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
    outformat=["png"],
):
    react = React("React SPA\n(Vite + TS)")

    with Cluster("Express 5 API  (Node.js + TypeScript)", graph_attr=cluster_style):
        from diagrams.programming.language import TypeScript
        api = TypeScript("Podcast\nPipeline")

    with Cluster("Azure AI Foundry", graph_attr=cluster_style):
        openai = AzureOpenai("Azure OpenAI\n(GPT-4.1)")
        speech = SpeechServices("Speech Batch\n(HD Voices)")

    blob = BlobStorage("Blob Storage\n(Episode Audio)")

    # Pipeline flow
    react >> Edge(label="  ①  Generate Script  ") >> api
    api >> Edge(label="  ②  Chat Completions  ") >> openai
    api >> Edge(label="  ③  Batch Synthesis (SSML)  ") >> speech
    speech >> Edge(label="  ④  Result ZIPs  ") >> blob
    api >> Edge(label="  ⑤  ffmpeg Stitch → Upload MP3  ") >> blob
