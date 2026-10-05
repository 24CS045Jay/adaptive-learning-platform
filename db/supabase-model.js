import { supabase } from "./supabase.js";

// Helper: Convert camelCase to snake_case
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// Helper: Convert snake_case to camelCase
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Transform an object's keys to snake_case for Supabase
export function objectToSnake(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || obj instanceof Date) return obj;
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === "_id") {
      result["id"] = val;
    } else {
      const snakeKey = toSnakeCase(key);
      result[snakeKey] = val;
    }
  }
  return result;
}

// Transform a Supabase row to camelCase with _id and id
export function rowToCamel(row, relations = {}) {
  if (!row || typeof row !== "object") return row;
  const doc = {};
  for (const [key, val] of Object.entries(row)) {
    const camelKey = key === "id" ? "id" : toCamelCase(key);
    doc[camelKey] = val;
  }
  doc._id = row.id || doc.id;
  doc.id = row.id || doc._id;

  // Add instance methods like save()
  Object.defineProperty(doc, "save", {
    value: async function () {
      const updates = objectToSnake(this);
      delete updates.id;
      delete updates._id;
      delete updates.created_at;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from(this.__tableName)
        .update(updates)
        .eq("id", this.id || this._id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return rowToCamel(data);
    },
    enumerable: false,
    writable: true,
  });

  Object.defineProperty(doc, "toObject", {
    value: function () {
      return { ...this };
    },
    enumerable: false,
    writable: true,
  });

  return doc;
}

class QueryBuilder {
  constructor(tableName, initialFilter = {}, isSingle = false) {
    this.tableName = tableName;
    this.filter = initialFilter;
    this.isSingle = isSingle;
    this._select = "*";
    this._sort = null;
    this._limit = null;
    this._populates = [];
  }

  select(fields) {
    if (typeof fields === "string") {
      const fieldList = fields.split(/\s+/).filter(Boolean);
      const excluded = fieldList.filter((f) => f.startsWith("-"));
      if (excluded.length > 0) {
        // Can filter in memory post-fetch
        this._excludedFields = excluded.map((f) => f.substring(1));
      }
    }
    return this;
  }

  populate(field, select) {
    this._populates.push({ field, select });
    return this;
  }

  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  limit(count) {
    this._limit = count;
    return this;
  }

  lean() {
    return this;
  }

  async _execute() {
    let query = supabase.from(this.tableName).select("*");

    // Apply filters
    for (const [key, value] of Object.entries(this.filter || {})) {
      if (key === "$or" && Array.isArray(value)) {
        // Handle basic $or
        const orConditions = value
          .map((cond) => {
            const [k, v] = Object.entries(cond)[0] || [];
            const col = k === "_id" ? "id" : toSnakeCase(k);
            return `${col}.eq.${v}`;
          })
          .join(",");
        if (orConditions) query = query.or(orConditions);
        continue;
      }

      const col = key === "_id" ? "id" : toSnakeCase(key);

      if (value === null || value === undefined) {
        query = query.is(col, null);
      } else if (typeof value === "object" && !Array.isArray(value)) {
        if (value.$in && Array.isArray(value.$in)) {
          query = query.in(col, value.$in);
        } else if (value.$nin && Array.isArray(value.$nin)) {
          query = query.not(col, "in", `(${value.$nin.join(",")})`);
        } else if (value.$gt !== undefined) {
          query = query.gt(col, value.$gt);
        } else if (value.$gte !== undefined) {
          query = query.gte(col, value.$gte);
        } else if (value.$lt !== undefined) {
          query = query.lt(col, value.$lt);
        } else if (value.$lte !== undefined) {
          query = query.lte(col, value.$lte);
        } else if (value.$ne !== undefined) {
          query = query.neq(col, value.$ne);
        } else if (value.$regex) {
          query = query.ilike(col, `%${value.$regex.source || value.$regex}%`);
        } else {
          query = query.eq(col, value);
        }
      } else if (typeof value === "string" && (value.startsWith("^") || value.includes(".*"))) {
        const cleanVal = value.replace(/^\^|\.\*/g, "");
        query = query.ilike(col, `%${cleanVal}%`);
      } else {
        query = query.eq(col, value);
      }
    }

    // Apply sorting
    if (this._sort) {
      if (typeof this._sort === "string") {
        const desc = this._sort.startsWith("-");
        const col = toSnakeCase(desc ? this._sort.substring(1) : this._sort);
        query = query.order(col, { ascending: !desc });
      } else if (typeof this._sort === "object") {
        for (const [col, dir] of Object.entries(this._sort)) {
          const snakeCol = col === "_id" ? "id" : toSnakeCase(col);
          query = query.order(snakeCol, { ascending: dir === 1 || dir === "asc" });
        }
      }
    } else {
      // Default order by created_at desc if available
      query = query.order("created_at", { ascending: false });
    }

    if (this._limit) {
      query = query.limit(this._limit);
    }

    if (this.isSingle) {
      const { data, error } = await query.maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error(`[Supabase Query Error in ${this.tableName}]:`, error.message);
        return null;
      }
      if (!data) return null;
      let item = rowToCamel(data);
      item.__tableName = this.tableName;
      item = await this._applyPopulates(item);
      if (this._excludedFields) {
        for (const f of this._excludedFields) delete item[f];
      }
      return item;
    }

    const { data, error } = await query;
    if (error) {
      console.error(`[Supabase Query Error in ${this.tableName}]:`, error.message);
      return [];
    }

    let items = (data || []).map((row) => {
      const item = rowToCamel(row);
      item.__tableName = this.tableName;
      return item;
    });

    if (this._populates.length > 0) {
      items = await Promise.all(items.map((it) => this._applyPopulates(it)));
    }

    if (this._excludedFields) {
      items.forEach((item) => {
        for (const f of this._excludedFields) delete item[f];
      });
    }

    return items;
  }

  async _applyPopulates(item) {
    if (!item) return item;
    for (const pop of this._populates) {
      const field = pop.field;
      const refId = item[field];
      if (!refId || typeof refId === "object") continue;

      let targetTable = null;
      if (field === "departmentId") targetTable = "departments";
      else if (field === "uploaderId" || field === "facultyId" || field === "studentId" || field === "createdBy" || field === "resolvedBy" || field === "actorId" || field === "userId") targetTable = "users";
      else if (field === "subjectId") targetTable = "subjects";
      else if (field === "quizId") targetTable = "quizzes";
      else if (field === "documentId") targetTable = "documents";
      else if (field === "moduleId") targetTable = "modules";

      if (targetTable) {
        const { data: refData } = await supabase
          .from(targetTable)
          .select("*")
          .eq("id", refId)
          .maybeSingle();
        if (refData) {
          item[field] = rowToCamel(refData);
        }
      }
    }
    return item;
  }

  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }
}

export function createSupabaseModel(tableName) {
  return {
    tableName,

    find(query = {}) {
      return new QueryBuilder(tableName, query, false);
    },

    findOne(query = {}) {
      return new QueryBuilder(tableName, query, true);
    },

    findById(id) {
      if (!id) return new QueryBuilder(tableName, { id: "none" }, true);
      const cleanId = typeof id === "object" ? String(id._id || id.id || id) : String(id);
      return new QueryBuilder(tableName, { id: cleanId }, true);
    },

    async create(doc) {
      if (Array.isArray(doc)) {
        return this.insertMany(doc);
      }
      const snakeDoc = objectToSnake(doc);
      if (!snakeDoc.id && doc._id) snakeDoc.id = String(doc._id);
      snakeDoc.created_at = snakeDoc.created_at || new Date().toISOString();
      snakeDoc.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from(tableName)
        .insert(snakeDoc)
        .select()
        .single();

      if (error) {
        console.error(`[Supabase Create Error in ${tableName}]:`, error.message);
        throw new Error(error.message);
      }
      const item = rowToCamel(data);
      item.__tableName = tableName;
      return item;
    },

    async insertMany(docs) {
      const snakeDocs = docs.map((d) => {
        const sd = objectToSnake(d);
        if (!sd.id && d._id) sd.id = String(d._id);
        sd.created_at = sd.created_at || new Date().toISOString();
        sd.updated_at = new Date().toISOString();
        return sd;
      });

      const { data, error } = await supabase
        .from(tableName)
        .insert(snakeDocs)
        .select();

      if (error) {
        console.error(`[Supabase InsertMany Error in ${tableName}]:`, error.message);
        throw new Error(error.message);
      }
      return (data || []).map((row) => {
        const item = rowToCamel(row);
        item.__tableName = tableName;
        return item;
      });
    },

    async findByIdAndUpdate(id, update, options = {}) {
      const cleanId = typeof id === "object" ? String(id._id || id.id || id) : String(id);
      const updateData = update.$set ? { ...update.$set } : { ...update };
      delete updateData.$set;
      delete updateData.$push;
      delete updateData.$pull;

      const snakeUpdate = objectToSnake(updateData);
      delete snakeUpdate.id;
      delete snakeUpdate._id;
      snakeUpdate.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from(tableName)
        .update(snakeUpdate)
        .eq("id", cleanId)
        .select()
        .maybeSingle();

      if (error) {
        console.error(`[Supabase Update Error in ${tableName}]:`, error.message);
        throw new Error(error.message);
      }
      if (!data) return null;
      const item = rowToCamel(data);
      item.__tableName = tableName;
      return item;
    },

    async findOneAndUpdate(query, update, options = {}) {
      const existing = await this.findOne(query);
      if (!existing) {
        if (options.upsert) {
          return this.create({ ...query, ...update });
        }
        return null;
      }
      return this.findByIdAndUpdate(existing.id, update, options);
    },

    async updateOne(query, update) {
      const target = await this.findOne(query);
      if (!target) return { matchedCount: 0, modifiedCount: 0 };
      await this.findByIdAndUpdate(target.id, update);
      return { matchedCount: 1, modifiedCount: 1 };
    },

    async updateMany(query, update) {
      const targets = await this.find(query);
      for (const t of targets) {
        await this.findByIdAndUpdate(t.id, update);
      }
      return { matchedCount: targets.length, modifiedCount: targets.length };
    },

    async findByIdAndDelete(id) {
      const cleanId = typeof id === "object" ? String(id._id || id.id || id) : String(id);
      const { data, error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", cleanId)
        .select()
        .maybeSingle();

      if (error) {
        console.error(`[Supabase Delete Error in ${tableName}]:`, error.message);
        throw new Error(error.message);
      }
      if (!data) return null;
      const item = rowToCamel(data);
      item.__tableName = tableName;
      return item;
    },

    async deleteOne(query) {
      const target = await this.findOne(query);
      if (!target) return { deletedCount: 0 };
      await this.findByIdAndDelete(target.id);
      return { deletedCount: 1 };
    },

    async deleteMany(query) {
      const targets = await this.find(query);
      for (const t of targets) {
        await this.findByIdAndDelete(t.id);
      }
      return { deletedCount: targets.length };
    },

    async countDocuments(query = {}) {
      let q = supabase.from(tableName).select("*", { count: "exact", head: true });
      for (const [key, value] of Object.entries(query)) {
        const col = key === "_id" ? "id" : toSnakeCase(key);
        if (value !== undefined) q = q.eq(col, value);
      }
      const { count, error } = await q;
      if (error) return 0;
      return count || 0;
    },
  };
}
