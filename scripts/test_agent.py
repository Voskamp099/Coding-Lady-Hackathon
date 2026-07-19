# test_agent.py
import asyncio
import json
from backend.agent import agent  # <--- 修改这里：从 app.agent 导入

# 测试文本
test_text = """
今天小明第一次独立完成了一个20块的数学拼图，非常兴奋！他一直在说'我做到了'。
"""

async def main():
    print("正在调用 Agent 提取记忆...\n")

    # 调用 agent 提取
    memory = await agent.extract(test_text)

    # 打印结果：用 model_dump(mode="json") 把 datetime 转成 ISO 字符串，
    # 再交给 json.dumps，避免 "datetime is not JSON serializable"。
    print("=== 提取结果 (JSON) ===")
    print(json.dumps(memory.model_dump(mode="json"), indent=2, ensure_ascii=False))

    print("\n=== 可读摘要 ===")
    print(memory.summary())


if __name__ == "__main__":
    asyncio.run(main())
