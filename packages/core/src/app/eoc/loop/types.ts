export interface CartMetafield {
  id: string;
  value: string;
}

export interface CartMetadataResp {
  body: {
    data?: {
      resource_id: string;
    };
  };
}
