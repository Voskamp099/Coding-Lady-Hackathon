# test_chat_agent.py
"""
对话 Agent 测试脚本。

用法：
  ./venv/bin/python test_chat_agent.py "我要不要去纽约工作"
  ./venv/bin/python test_chat_agent.py "我应该去上海工作吗"
  ./venv/bin/python test_chat_agent.py "我小时候是什么样的小孩？"

会打印：检索到的记忆 + Layer3 价值综合 + Agent 的完整回答。
"""
import asyncio
import sys
import json

from backend.chat_agent import chat_agent


async def main():
    if len(sys.argv) > 1:
        question = " ".join(sys.argv[1:])
    else:
        question = "我要不要去上海工作？"

    print(f"💬 用户提问：{question}\n")
    print("⏳ 正在检索记忆 + 跑 Layer3 价值综合 + 调 LLM 分析...\n")

    result = await chat_agent.chat(question, k=8, with_evidence=True)

    print("=" * 60)
    print(f"📊 检索到 {result['stats']['retrieved']} 条相关记忆（全库 {result['stats']['total_memories']} 条）")
    print("=" * 60)
    for rm in result.get("retrieved_memories", []):
        print(f"  [{rm['timestamp']}] (score={rm['score']}) {rm['event']}")
        if rm.get("behaviors"):
            print(f"     行为: {', '.join(rm['behaviors'])}")

    print("\n" + "=" * 60)
    print("🧠 Layer3 价值综合")
    print("=" * 60)
    vs = result.get("value_synthesis")
    if vs:
        for v in vs.get("values", []):
            print(f"  - {v['value']}({v['cn']}) conf={v['confidence']:.2f}")
            for ev in v.get("evidence", [])[:1]:
                print(f"      证据: {ev}")
        if vs.get("trend"):
            print(f"  趋势: {vs['trend']}")
    else:
        print("  （无）")

    print("\n" + "=" * 60)
    print("🤖 Agent 回答")
    print("=" * 60)
    print(result["answer"])


if __name__ == "__main__":
    asyncio.run(main())
