CREATE UNIQUE INDEX collection_items_binder_position_unique ON public.collection_items USING btree (user_id, folder_id, binder_page, binder_slot) WHERE ((folder_id IS NOT NULL) AND (binder_page IS NOT NULL) AND (binder_slot IS NOT NULL));
CREATE INDEX collection_items_folder_idx ON public.collection_items USING btree (folder_id);
CREATE INDEX collection_items_lookup_idx ON public.collection_items USING btree (user_id, tcg, set_name, card_number);
CREATE INDEX collection_items_user_created_idx ON public.collection_items USING btree (user_id, created_at DESC);
CREATE INDEX collection_items_user_id_idx ON public.collection_items USING btree (user_id);
