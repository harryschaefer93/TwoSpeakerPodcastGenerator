"""
PodcastGen — Architecture Diagram Generator

Run:  python docs/diagrams/generate.py
Out:  docs/diagrams/architecture-overview.png
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.azure.aimachinelearning import AzureOpenai, SpeechServices
from diagrams.azure.storage import BlobStorage
from diagrams.programming.framework import React
from diagrams.programming.language import TypeScript

graph_attr = {
    "fontsize": "28",
    "bgcolor": "white",
    "pad": "1.0",
    "nodesep": "1.2",
    "ranksep": "2.5",
    "dpi": "150",
    "fontname": "Segoe UI Bold",
    "splines": "ortho",
    "label": "PodcastGen — Architecture\nAll Azure auth via DefaultAzureCredential (Entra ID)",
    "labelloc": "t",
    "labeljust": "c",
    "fontcolor": "#333333",
}

node_attr = {
    "fontsize": "14",
    "fontname": "Segoe UI Bold",
}

edge_attr = {
    "fontsize": "11",
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
    "margin": "36",
    "labeljust": "l",
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
        api = TypeScript("Podcast\nPipeline")

    with Cluster("Azure AI Foundry", graph_attr=cluster_style):
        openai = AzureOpenai("Azure OpenAI\n(GPT-4.1)")
        speech = SpeechServices("Speech Batch\n(HD Voices)")

    blob = BlobStorage("Blob Storage\n(Episode Audio)")

    # Trailing \n in labels pushes text above the edge line
    react >> Edge(label="①  Generate Script\n ") >> api
    api >> Edge(label="②  Chat Completions\n ") >> openai
    api >> Edge(label="③  Batch Synthesis\n ") >> speech
    speech >> Edge(label="④  Result ZIPs\n ") >> blob
    api >> Edge(label="⑤  Stitch & Upload MP3\n ") >> blob
