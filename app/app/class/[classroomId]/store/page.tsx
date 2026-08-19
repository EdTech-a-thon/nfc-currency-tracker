"use client";

import { use, useState } from "react";
import { pb, readableError, type Classroom, type StoreItem } from "@/lib/pocketbase";
import { useLoader, useTeacher } from "@/lib/session";

export default function Store({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = use(params);
  const teacher = useTeacher();
  const [message, setMessage] = useState("");

  const { data, error, reload } = useLoader(async () => {
    if (!teacher) return null;
    const [classroom, items] = await Promise.all([
      pb.collection("classrooms").getOne<Classroom>(classroomId),
      pb.collection("store_items").getFullList<StoreItem>({ sort: "sortOrder,name" }),
    ]);
    return { classroom, items };
  }, [teacher?.id, classroomId]);

  // Stock is left blank for an unlimited item, which PocketBase stores as a flag.
  function readItem(form: FormData) {
    const stock = String(form.get("stock")).trim();
    return {
      name: String(form.get("name")).trim(),
      price: Number(form.get("price")),
      trackStock: stock !== "",
      stock: stock === "" ? 0 : Number(stock),
      active: String(form.get("active")) !== "false",
    };
  }

  async function save(event: React.FormEvent<HTMLFormElement>, itemId?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const values = readItem(new FormData(form));
      if (itemId) await pb.collection("store_items").update(itemId, values);
      else {
        await pb.collection("store_items").create({
          teacher: teacher!.id, ...values, sortOrder: (data?.items.length ?? 0) + 1,
        });
        form.reset();
      }
      setMessage("Store item saved.");
      reload();
    } catch (problem) {
      setMessage(readableError(problem));
    }
  }

  if (!teacher) return null;
  if (error) return <p className="panel p-8">{error}</p>;
  if (!data) return <p className="panel p-8">Loading your store...</p>;
  const { classroom, items } = data;

  return <div className="grid gap-6">
    <div className="flex flex-wrap items-end justify-between"><div><p className="font-bold text-[#e85d43]">Shared across your classes</p><h1 className="text-4xl">Account store</h1></div>{!classroom.archived && <a className="btn btn-accent" href={`/app/class/${classroomId}/checkout`}>Start checkout for {classroom.name}</a>}</div>
    {message && <div className="rounded-xl bg-[#cde7d8] p-4 font-bold text-green-900" role="status">{message}</div>}
    <form onSubmit={(event) => void save(event)} className="panel grid gap-3 p-5 md:grid-cols-[1fr_120px_160px_auto]"><label className="label">Item name<input className="field" name="name" placeholder="e.g. Homework pass" required /></label><label className="label">Price<input className="field" name="price" type="number" min="1" placeholder="Cost" required /></label><label className="label">Stock available<input className="field" name="stock" type="number" min="1" placeholder="Unlimited" /></label><button className="btn self-end">Add item</button></form>
    <section className="grid gap-3">
      <div className="hidden grid-cols-[70px_minmax(0,1fr)_120px_160px_120px_auto] items-center gap-3 border-b-2 border-[#23312c] px-4 pb-2 text-xs font-bold uppercase tracking-wider text-slate-600 md:grid"><span>Order</span><span>Item name</span><span>Price</span><span>Stock available</span><span>Available to sell</span><span>Action</span></div>
      {items.map((item, index) => <form onSubmit={(event) => void save(event, item.id)} className={`panel grid items-end gap-3 p-4 md:grid-cols-[70px_minmax(0,1fr)_120px_160px_120px_auto] ${!item.active ? "opacity-60" : ""}`} key={item.id}><span className="display self-center text-2xl" aria-label={`Display order ${index + 1}`}>{index + 1}</span><label className="label md:hidden">Item name</label><input className="field" name="name" defaultValue={item.name} required /><label className="label md:hidden">Price</label><input className="field" name="price" type="number" min="1" defaultValue={item.price} required /><label className="label md:hidden">Stock available</label><input className="field" name="stock" type="number" min="1" defaultValue={item.trackStock ? item.stock : ""} placeholder="Unlimited" /><label className="label md:hidden">Available to sell</label><select className="field" name="active" defaultValue={String(item.active)}><option value="true">Available</option><option value="false">Hidden</option></select><button className="btn btn-soft">Save</button></form>)}
      {!items.length && <p className="panel p-8 text-center">No store items yet. Add one above.</p>}
    </section>
  </div>;
}
