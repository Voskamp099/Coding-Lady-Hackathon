# prepare_data.py
"""
数据导入脚本（三层流水线版）。

用法：
  # 默认导入（用 .env 里的 DATASET_CSV_PATH）
  ./venv/bin/python prepare_data.py

  # 清空库后重新导入（切换数据集时用）
  ./venv/bin/python prepare_data.py --clear

  # 只导前 5 条（快速测试）
  ./venv/bin/python prepare_data.py --max 5

  # 导完后顺带跑一次 Layer3 全库价值综合
  ./venv/bin/python prepare_data.py --layer3

切换数据集：改 .env 里的 DATASET_CSV_PATH 和 DATASET_LABEL，或加 --csv 路径 --label 标签。
"""
import argparse
import asyncio
import csv
import os
import sys

from backend.config import get_settings, resolve_dataset_path
from backend.agent import agent
from backend.memory_repository import memory_exists_by_raw_text, count_memories, clear_database


async def ingest_data(csv_path: str, max_rows: int, run_layer3: bool, child_name: str = "在的李生体"):
    if not os.path.exists(csv_path):
        print(f"❌ 找不到数据集: {csv_path}")
        return

    print(f"🚀 开始导入：{csv_path}")
    print(f"   数据集标签: {get_settings().dataset_label}")
    print(f"   当前库已有 {count_memories()} 条\n")

    new_count = 0
    skip_count = 0
    processed = 0

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        next(reader, None)  # 跳过表头 "时间（年龄）,人类记录"

        for row in reader:
            if not row or len(row) < 2:
                continue
            if max_rows and processed >= max_rows:
                break

            time_str, human_record = row[0], row[1]
            raw_text = f"时间：{time_str}\n记录：{human_record}"

            # data-based 去重：已存在则跳过
            if memory_exists_by_raw_text(raw_text):
                skip_count += 1
                processed += 1
                print(f"[{processed}] ⏭️  已存在，跳过: {time_str}")
                continue

            print(f"[{processed+1}] 正在提取(Layer1+2): {time_str}")
            try:
                memory = await agent.extract(
                    raw_text,
                    metadata={"source": "csv_import", "age_info": time_str,
                              "dataset": get_settings().dataset_label,
                              "child_name": child_name},
                    child_name=child_name,
                )
                new_count += 1
                print(f"    ✅ 新建: {memory.event}")
                print(f"       行为: {', '.join(memory.behaviors) or '无'} | "
                      f"置信度: {memory.behavior_confidence:.2f}")
            except Exception as e:
                print(f"    ❌ 提取失败: {e}")

            processed += 1
            await asyncio.sleep(0.3)  # 轻微限流

    print(f"\n🎉 导入完成！新建 {new_count} | 跳过 {skip_count} | 库总计 {count_memories()} 条")

    if run_layer3 and count_memories() > 0:
        print("\n🧠 正在跑 Layer3 全库价值综合...")
        try:
            analysis = await agent.analyze_values(scope="all")
            print(f"   识别出 {len(analysis.values)} 个价值信号：")
            for v in analysis.values:
                print(f"   - {v.value} (conf={v.confidence:.2f}): {v.evidence[:1]}")
            print(f"   趋势: {analysis.trend}")
        except Exception as e:
            print(f"   ❌ Layer3 失败: {e}")


def main():
    parser = argparse.ArgumentParser(description="TimeMirror 数据导入")
    parser.add_argument("--clear", action="store_true", help="导入前清空数据库")
    parser.add_argument("--max", type=int, default=0, help="最大导入条数（0=全部）")
    parser.add_argument("--layer3", action="store_true", help="导完后跑一次 Layer3 价值综合")
    parser.add_argument("--csv", type=str, default=None, help="覆盖 DATASET_CSV_PATH")
    parser.add_argument("--label", type=str, default=None, help="覆盖 DATASET_LABEL")
    args = parser.parse_args()

    # CLI 覆盖配置
    if args.csv or args.label:
        s = get_settings()
        if args.csv:
            s.dataset_csv_path = args.csv
        if args.label:
            s.dataset_label = args.label

    if args.clear:
        report = clear_database()
        print(f"🗑️  已清空数据库: {report}\n")

    csv_path = resolve_dataset_path()
    max_rows = args.max or get_settings().ingest_max_rows
    asyncio.run(ingest_data(csv_path, max_rows, args.layer3, args.child))


if __name__ == "__main__":
    main()
